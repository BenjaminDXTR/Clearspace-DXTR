const fs = require('fs').promises;
const path = require('path');
const { log } = require('./utils/logger');
const { config } = require('./config');

const historyBaseDir = path.resolve(__dirname, config.backend.historyBaseDir || 'history');
const INACTIVE_TIMEOUT = 5000; // Timeout réduit à 5 secondes pour tests

const historyCache = new Map();
const lastSeenMap = new Map();

/**
 * Calcule la période (dimanche-samedi) et génère un nom de fichier pour une date donnée.
 * @param {string} dateStr ISO string date
 * @returns {{start: string, end: string, filename: string}}
 */
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

/**
 * Charge un fichier historique depuis le disque ou retourne un tableau vide si absent.
 * @param {string} filePath
 * @returns {Promise<Array>}
 */
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

/**
 * Sauvegarde données JSON dans un fichier, avec log succès ou erreur.
 * @param {string} filePath
 * @param {Array} data
 */
async function saveHistoryFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    log(`[saveHistoryFile] Sauvegarde réussie dans ${filePath}`);
  } catch (e) {
    log(`[saveHistoryFile] Erreur écriture ${filePath}: ${e.message}`);
  }
}

/**
 * Met à jour ou ajoute un vol dans le tableau d'historique en mémoire.
 * La clé est composée de id + created_time pour unicité.
 * @param {object} flight
 * @param {Array} historyFile
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  const flightKey = flight.id + '|' + flight.created_time;
  const traceLength = Array.isArray(flight.trace) ? flight.trace.length : 0;

  const idx = historyFile.findIndex(f => (f.id + '|' + f.created_time) === flightKey);
  if (idx !== -1) {
    historyFile[idx] = flight;
    log(`[addOrUpdateFlightInFile] Mise à jour vol ${flightKey} avec trace (${traceLength} points)`);
  } else {
    historyFile.push(flight);
    log(`[addOrUpdateFlightInFile] Ajout vol ${flightKey} avec trace (${traceLength} points)`);
  }
}

/**
 * Charge le contenu historique en cache pour un fichier donné.
 * Si absent en cache, charge depuis disque et mémorise.
 * @param {string} filename
 * @returns {Promise<Array>}
 */
async function loadHistoryToCache(filename) {
  if (!historyCache.has(filename)) {
    const filePath = path.join(historyBaseDir, filename);
    log(`[loadHistoryToCache] Chargement fichier historique en cache: ${filename}`);
    const data = await loadHistoryFile(filePath);
    historyCache.set(filename, data);
  }
  return historyCache.get(filename);
}

/**
 * Sauvegarde la donnée en cache sur disque.
 * @param {string} filename
 */
async function flushCacheToDisk(filename) {
  if (!historyCache.has(filename)) return;
  const data = historyCache.get(filename);
  const filePath = path.join(historyBaseDir, filename);
  await saveHistoryFile(filePath, data);
}

/**
 * Sauvegarde toutes les données cache sur disque.
 */
async function flushAllCache() {
  for (const filename of historyCache.keys()) {
    await flushCacheToDisk(filename);
  }
  log('[flushAllCache] Flush complet du cache vers disque effectué');
}

/**
 * Sauvegarde un vol dans l'historique, en incluant la trace.
 * Met à jour lastSeenMap si vol live.
 * Garantit les champs nécessaires et logue les détails.
 * @param {object} flight
 * @returns {Promise<string>} - nom du fichier historique
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

  const traceLength = Array.isArray(flight.trace) ? flight.trace.length : 0;
  log(`[saveFlightToHistory] Trace reçue pour vol ${flight.id}: ${traceLength} points`);

  const flightToSave = {
    ...flight,
    trace: traceLength > 0 ? flight.trace : [],
  };

  addOrUpdateFlightInFile(flightToSave, historyData);
  historyCache.set(historyFilePath, historyData);

  await flushCacheToDisk(historyFilePath);

  log(`[saveFlightToHistory] Vol sauvegardé dans historique ${historyFilePath} (ID=${flight.id}) avec trace (${flightToSave.trace.length} points)`);

  return historyFilePath;
}

/**
 * Archive les vols inactifs en les marquant local
 * puis met à jour l'historique.
 */
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
