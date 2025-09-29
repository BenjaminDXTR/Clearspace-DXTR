const fs = require('fs').promises;
const path = require('path');
const { log } = require('./utils/logger');
const { config } = require('./config');

const historyBaseDir = path.resolve(__dirname, config.backend.historyBaseDir || 'history');
const INACTIVE_TIMEOUT = 10000; // timeout vol inactif (ms)

const MAX_TRACE_LENGTH = 1000; // limite taille trace en points
const DISTANCE_EPSILON = 0.00001; // seuil distance min entre deux points (~1m)

// Caches en mémoire
const historyCache = new Map();
const lastSeenMap = new Map();
const createdTimeMap = new Map();

function getWeekPeriod(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToSunday = -day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + diffToSunday);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  const fmt = (date) => date.toISOString().slice(0, 10);
  return {
    start: fmt(sunday),
    end: fmt(saturday),
    filename: `history-${fmt(sunday)}_to_${fmt(saturday)}.json`,
  };
}

function distanceSquared(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return dx * dx + dy * dy;
}

async function loadHistoryFile(filePath) {
  try {
    await fs.access(filePath);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      log(`[loadHistoryFile] Erreur lecture ${filePath}: ${e.message}`);
    }
    return [];
  }
}

async function saveHistoryFile(filePath, data) {
  if (!Array.isArray(data) || data.length === 0) {
    log(`[saveHistoryFile] Données vides, sauvegarde annulée pour ${filePath}`);
    return;
  }
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    log(`[saveHistoryFile] Sauvegarde réussie dans ${filePath} (${data.length} entrées)`);
  } catch (e) {
    log(`[saveHistoryFile] Erreur écriture ${filePath}: ${e.message}`);
  }
}

function addOrUpdateFlightInFile(flight, historyFile) {
  const now = Date.now();
  const lastSeen = lastSeenMap.get(flight.id) || 0;
  const sessionCreatedTime = createdTimeMap.get(flight.id);

  const isStillActive = (now - lastSeen) <= INACTIVE_TIMEOUT;

  log(`[addOrUpdateFlightInFile] DroneID=${flight.id}, now=${now}, lastSeen=${lastSeen}, session active=${isStillActive}`);

  const flightsSameId = historyFile.filter(f => f.id === flight.id)
    .sort((a, b) => new Date(b.created_time) - new Date(a.created_time));

  if (isStillActive && flightsSameId.length > 0) {
    const lastFlight = flightsSameId[0];
    if (!sessionCreatedTime) {
      createdTimeMap.set(flight.id, lastFlight.created_time);
    }

    // Remplacer la trace existante par la trace complète récente (sans concaténation)
    let newTrace = Array.isArray(flight.trace) ? flight.trace.slice() : [];

    // Limitation de taille si necessaire
    if (newTrace.length > MAX_TRACE_LENGTH) {
      newTrace = newTrace.slice(newTrace.length - MAX_TRACE_LENGTH);
      log(`[addOrUpdateFlightInFile] Trace vol ${flight.id} tronquée à ${MAX_TRACE_LENGTH} points`);
    }

    const updatedFlight = {
      ...lastFlight,
      ...flight,
      trace: newTrace,
      created_time: createdTimeMap.get(flight.id),
    };

    const idx = historyFile.findIndex(f => f.id === lastFlight.id && f.created_time === lastFlight.created_time);

    if (idx !== -1) {
      historyFile[idx] = updatedFlight;
      log(`[addOrUpdateFlightInFile] Mise à jour session active drone ${flight.id} créé le ${updatedFlight.created_time} - trace (${newTrace.length} pts)`);
      return;
    }
  }

  // Nouvelle session détectée
  const newCreated = new Date().toISOString();
  createdTimeMap.set(flight.id, newCreated);
  flight.created_time = newCreated;
  flight.trace = Array.isArray(flight.trace) ? flight.trace : [];

  historyFile.push(flight);
  log(`[addOrUpdateFlightInFile] Nouvelle session créée drone ${flight.id} avec created_time ${flight.created_time}`);
}

async function loadHistoryToCache(filename) {
  if (!historyCache.has(filename)) {
    const filePath = path.join(historyBaseDir, filename);
    log(`[loadHistoryToCache] Chargement historique ${filename} en cache`);
    const data = await loadHistoryFile(filePath);
    historyCache.set(filename, data);
  }
  return historyCache.get(filename);
}

async function flushCacheToDisk(filename) {
  if (!historyCache.has(filename)) return;
  const data = historyCache.get(filename);
  const filePath = path.join(historyBaseDir, filename);
  await saveHistoryFile(filePath, data);
}

async function flushAllCache() {
  for (const filename of historyCache.keys()) {
    await flushCacheToDisk(filename);
  }
  log('[flushAllCache] Cache sauvegardé');
}

async function saveFlightToHistory(flight) {
  if (!flight.type) flight.type = 'live';

  if (flight.type === 'live' && flight.id) {
    lastSeenMap.set(flight.id, Date.now());
    if (!createdTimeMap.has(flight.id)) {
      createdTimeMap.set(flight.id, flight.created_time || new Date().toISOString());
    }
  }

  try {
    await fs.access(historyBaseDir);
  } catch {
    await fs.mkdir(historyBaseDir, { recursive: true });
  }

  if (!flight.created_time) {
    flight.created_time = new Date().toISOString();
  }

  const period = getWeekPeriod(flight.created_time);
  const historyFile = period.filename;

  const historyData = await loadHistoryToCache(historyFile);

  const traceLen = Array.isArray(flight.trace) ? flight.trace.length : 0;
  log(`[saveFlightToHistory] Trace reçue drone ${flight.id} : ${traceLen} points`);

  const flightToSave = {
    ...flight,
    trace: traceLen > 0 ? flight.trace : [],
  };

  addOrUpdateFlightInFile(flightToSave, historyData);

  historyCache.set(historyFile, historyData);

  await flushCacheToDisk(historyFile);

  log(`[saveFlightToHistory] Drone ${flight.id} sauvegardé dans ${historyFile} avec ${flightToSave.trace.length} points de trace`);

  return historyFile;
}

async function archiveInactiveFlights() {
  const now = Date.now();

  try {
    await fs.access(historyBaseDir);
  } catch {
    return;
  }

  const files = (await fs.readdir(historyBaseDir)).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const data = await loadHistoryToCache(file);
    let updated = false;

    data.forEach(flight => {
      if (flight.type === 'live' && flight.id) {
        const lastSeen = lastSeenMap.get(flight.id) || 0;
        if ((now - lastSeen) > INACTIVE_TIMEOUT) {
          flight.type = 'local';
          updated = true;
          createdTimeMap.delete(flight.id);
          log(`[archiveInactiveFlights] Vol ${flight.id} archivé dans ${file}`);
        }
      }
    });

    if (updated) {
      historyCache.set(file, data);
      await flushCacheToDisk(file);
      log(`[archiveInactiveFlights] Fichier ${file} mis à jour`);
    }
  }
}

module.exports = {
  saveFlightToHistory,
  archiveInactiveFlights,
  flushCacheToDisk,
  flushAllCache,
  getWeekPeriod
};
