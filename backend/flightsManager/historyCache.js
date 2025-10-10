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
    //log.info(`[loadHistoryToCache] Loading ${filename} into cache from ${filePath}`);
    try {
      const data = await loadHistoryFile(filePath);
      historyCache.set(filename, data);
      //log.info(`[loadHistoryToCache] Loaded ${data.length} entries into cache for ${filename}`);
    } catch (e) {
      log.error(`[loadHistoryToCache] Error loading ${filename}: ${e.message}`);
      historyCache.set(filename, []);
    }
  } else {
    //log.debug(`[loadHistoryToCache] Cache hit for ${filename} with ${historyCache.get(filename).length} entries`);
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
    //log.info(`[flushCacheToDisk] Saving cache to disk for file ${filename} at ${filePath} with ${data.length} entries`);
    await saveHistoryFile(filePath, data);
    //log.info(`[flushCacheToDisk] Successfully saved cache for file ${filename}`);
  } catch (e) {
    log.error(`[flushCacheToDisk] Error saving cache for file ${filename}: ${e.message}`);
  }
}

async function flushAllCache() {
  const filenames = Array.from(historyCache.keys());
  //log.info(`[flushAllCache] Flushing all caches (${filenames.length} files)`);
  for (const filename of filenames) {
    await flushCacheToDisk(filename);
  }
  //log.info('[flushAllCache] All cache flushed successfully');
}

const DATE_REGEX = /^history-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.json$/;

// Parses input date safely from string or Date object
function parseDateInput(dateInput) {
  if (!dateInput) {
    log.warn('[parseDateInput] Date input is null or undefined, defaulting to now');
    return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  }
  
  if (typeof dateInput === 'string') {
    return new Date(dateInput.slice(0, 10) + 'T00:00:00Z');
  } else if (dateInput instanceof Date) {
    return new Date(dateInput.toISOString().slice(0, 10) + 'T00:00:00Z');
  } else {
    log.warn('[parseDateInput] Unknown date input type, defaulting to now');
    return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  }
}


function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Recherche dans le dossier history un fichier couvrant la date donnée,
 * ou crée un nouveau fichier couvrant la période de 7 jours glissants à partir de cette date.
 *
 * @param {string|Date} dateStr date au format ISO "YYYY-MM-DD", iso string, ou Date objet
 * @returns {string} nom fichier historique
 */
async function findOrCreateHistoryFile(dateStr) {
  await ensureHistoryDirExists();

  const files = await fs.readdir(historyBaseDir);
  const date = parseDateInput(dateStr);

  for (const file of files) {
    const match = file.match(DATE_REGEX);
    if (match) {
      const start = new Date(match[1] + 'T00:00:00Z');
      const end = new Date(match[2] + 'T00:00:00Z');
      if (date >= start && date <= end) {
        //log.info(`[historyCache] Found existing history file ${file} covering date ${dateStr}`);
        return file;
      }
    }
  }

  const start = date;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const newFile = `history-${formatDate(start)}_to_${formatDate(end)}.json`;
  log.info(`[historyCache] No existing file for date ${dateStr}, creating new file ${newFile}`);

  if (!historyCache.has(newFile)) {
    historyCache.set(newFile, []);
  }

  return newFile;
}

module.exports = {
  loadHistoryToCache,
  flushCacheToDisk,
  flushAllCache,
  historyCache,
  findOrCreateHistoryFile,
};
