const path = require('path');
const fs = require('fs').promises;
const log = require('../utils/logger');
const { loadHistoryFile, saveHistoryFile } = require('./fileOperations');

const historyCache = new Map();
const historyBaseDir = path.resolve(__dirname, '../history');

async function ensureHistoryDirExists() {
  try {
    await fs.access(historyBaseDir);
  } catch {
    try {
      await fs.mkdir(historyBaseDir, { recursive: true });
      log.info(`[historyCache] Created history directory at ${historyBaseDir}`);
    } catch (e) {
      log.error(`[historyCache] Failed to create history directory: ${e.message}`);
      throw e;
    }
  }
}

async function loadHistoryToCache(filename) {
  await ensureHistoryDirExists();
  if (!historyCache.has(filename)) {
    const filePath = path.join(historyBaseDir, filename);
    log.info(`[loadHistoryToCache] Loading ${filename} into cache from ${filePath}`);
    try {
      const data = await loadHistoryFile(filePath);
      historyCache.set(filename, data);
      log.info(`[loadHistoryToCache] Loaded ${data.length} entries into cache for ${filename}`);
    } catch (e) {
      log.error(`[loadHistoryToCache] Error loading ${filename}: ${e.message}`);
      historyCache.set(filename, []);
    }
  } else {
    log.debug(`[loadHistoryToCache] Cache hit for ${filename} with ${historyCache.get(filename).length} entries`);
  }
  return historyCache.get(filename);
}

async function flushCacheToDisk(filename) {
  await ensureHistoryDirExists();
  if (!historyCache.has(filename)) {
    log.warn(`[flushCacheToDisk] No cache found for file ${filename}, skipping flush`);
    return;
  }
  const data = historyCache.get(filename);
  const filePath = path.join(historyBaseDir, filename);
  try {
    log.info(`[flushCacheToDisk] Saving cache to disk for file ${filename} at ${filePath} with ${data.length} entries`);
    await saveHistoryFile(filePath, data);
    log.info(`[flushCacheToDisk] Successfully saved cache for file ${filename}`);
  } catch (e) {
    log.error(`[flushCacheToDisk] Error saving cache for file ${filename}: ${e.message}`);
  }
}

async function flushAllCache() {
  const filenames = Array.from(historyCache.keys());
  log.info(`[flushAllCache] Flushing all caches (${filenames.length} files)`);
  for (const filename of filenames) {
    await flushCacheToDisk(filename);
  }
  log.info('[flushAllCache] All cache flushed successfully');
}

// --- Nouvelle fonction pour recherche/création fichier historique ---
const DATE_REGEX = /^history-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.json$/;

function parseDate(str) {
  return new Date(str + 'T00:00:00Z');
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Recherche dans le dossier history un fichier couvrant la date donnée,
 * ou crée un nouveau fichier couvrant la période de 7 jours glissants à partir de cette date.
 *
 * @param {string} dateStr date au format ISO "YYYY-MM-DD" ou iso string
 * @returns {string} nom fichier historique
 */
async function findOrCreateHistoryFile(dateStr) {
  await ensureHistoryDirExists();

  const files = await fs.readdir(historyBaseDir);
  const date = parseDate(dateStr.slice(0, 10)); // garantir format date iso YYYY-MM-DD

  // Chercher fichier couvrant la date
  for (const file of files) {
    const match = file.match(DATE_REGEX);
    if (match) {
      const start = parseDate(match[1]);
      const end = parseDate(match[2]);
      if (date >= start && date <= end) {
        log.info(`[historyCache] Found existing history file ${file} covering date ${dateStr}`);
        return file;
      }
    }
  }

  // Aucun fichier couvrant la date, créer une nouvelle période glissante 7 jours
  const start = date;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const newFile = `history-${formatDate(start)}_to_${formatDate(end)}.json`;
  log.info(`[historyCache] No existing file for date ${dateStr}, creating new file ${newFile}`);

  // Initialise fichier vide dans cache pour ce nouveau fichier (créé à la sauvegarde)
  if (!historyCache.has(newFile)) {
    historyCache.set(newFile, []);
  }

  return newFile;
}

// --- Exporter la nouvelle fonction ---
module.exports = {
  loadHistoryToCache,
  flushCacheToDisk,
  flushAllCache,
  historyCache,
  findOrCreateHistoryFile
};
