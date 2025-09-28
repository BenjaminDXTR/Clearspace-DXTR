const fs = require('fs').promises;
const path = require('path');
const { log } = require('./utils/logger');
const { config } = require('./config');

const historyBaseDir = path.resolve(__dirname, config.backend.historyBaseDir || 'history');
const INACTIVE_TIMEOUT = 5000; // Timeout réduit à 5 secondes pour tests rapides

const historyCache = new Map();
const lastSeenMap = new Map();

function getWeekPeriod(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToSunday = -day;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + diffToSunday);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);

  function fmt(date) {
    return date.toISOString().slice(0, 10);
  }
  return {
    start: fmt(sunday),
    end: fmt(saturday),
    filename: `history-${fmt(sunday)}_to_${fmt(saturday)}.json`
  };
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
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    log(`[saveHistoryFile] Sauvegarde réussie dans ${filePath}`);
  } catch (e) {
    log(`[saveHistoryFile] Erreur écriture ${filePath}: ${e.message}`);
  }
}

function addOrUpdateFlightInFile(flight, historyFile) {
  const flightKey = flight.id + '|' + flight.created_time;
  const idx = historyFile.findIndex(f => (f.id + '|' + f.created_time) === flightKey);
  if (idx !== -1) {
    historyFile[idx] = flight;
    log(`[addOrUpdateFlightInFile] Mise à jour vol ${flightKey}`);
  } else {
    historyFile.push(flight);
    log(`[addOrUpdateFlightInFile] Ajout vol ${flightKey}`);
  }
}

async function loadHistoryToCache(filename) {
  if (!historyCache.has(filename)) {
    const filePath = path.join(historyBaseDir, filename);
    log(`[loadHistoryToCache] Chargement fichier historique en cache: ${filename}`);
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
  log('[flushAllCache] Flush complet du cache vers disque effectué');
}

/**
 * Sauvegarde ou met à jour un vol dans l'historique,
 * en y incluant la trace complète si elle est présente,
 * retourne le nom du fichier historique modifié.
 */
async function saveFlightToHistory(flight) {
  if (!flight.created_time) flight.created_time = new Date().toISOString();
  if (!flight.type) flight.type = "live";

  if (flight.type === "live" && flight.id) {
    lastSeenMap.set(flight.id, Date.now());
  }

  try {
    await fs.access(historyBaseDir);
  } catch {
    await fs.mkdir(historyBaseDir, { recursive: true });
  }

  const period = getWeekPeriod(flight.created_time);
  const historyFilePath = period.filename;

  const historyData = await loadHistoryToCache(historyFilePath);

  // Construire un objet vol à sauvegarder incluant la trace (fallback si manquant)
  const flightToSave = {
    ...flight,
    trace: Array.isArray(flight.trace) ? flight.trace : (flight.tracing?.points ?? []),
  };

  addOrUpdateFlightInFile(flightToSave, historyData);

  historyCache.set(historyFilePath, historyData);

  await flushCacheToDisk(historyFilePath);
  log(`[saveFlightToHistory] Vol sauvegardé dans historique ${historyFilePath} (ID=${flight.id})`);

  return historyFilePath;
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

    data.forEach((flight) => {
      if (flight.type === 'live' && flight.id) {
        const lastSeen = lastSeenMap.get(flight.id) || 0;
        if ((now - lastSeen) > INACTIVE_TIMEOUT) {
          flight.type = 'local';
          updated = true;
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
  getWeekPeriod,
};
