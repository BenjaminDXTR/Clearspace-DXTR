const path = require('path');
const fs = require('fs').promises;
const log = require('../utils/logger');
const { loadHistoryFile, saveHistoryFile } = require('./fileOperations');

// Cache mémoire des historiques chargés
const historyCache = new Map();

// Chemin racine du dossier historique
const historyBaseDir = path.resolve(__dirname, '../history');

/**
 * Vérifie et crée le dossier d'historique s'il n'existe pas.
 */
async function ensureHistoryDirExists() {
  try {
    await fs.access(historyBaseDir);
  } catch {
    try {
      await fs.mkdir(historyBaseDir, { recursive: true });
      //log.info(`[historyCache] Created history directory at ${historyBaseDir}`);
    } catch (e) {
      log.error(`[historyCache] Failed to create history directory: ${e.message}`);
      throw e;
    }
  }
}

/**
 * Charge un fichier historique en cache, si pas déjà chargé.
 * Renvoie le tableau des sessions vol chargées.
 * @param {string} filename Nom fichier historique
 * @returns {Promise<Array>} Données en cache
 */
async function loadHistoryToCache(filename) {
  await ensureHistoryDirExists();
  if (!historyCache.has(filename)) {
    const filePath = path.join(historyBaseDir, filename);
    try {
      const data = await loadHistoryFile(filePath);
      historyCache.set(filename, data);
      //log.info(`[loadHistoryToCache] Loaded ${data.length} entries into cache for ${filename}`);
    } catch (e) {
      log.error(`[loadHistoryToCache] Error loading ${filename}: ${e.message}`);
      // Init cache vide en cas d’erreur pour ce fichier
      historyCache.set(filename, []);
    }
  } else {
    //log.debug(`[loadHistoryToCache] Cache hit for ${filename} with ${historyCache.get(filename).length} entries`);
  }
  return historyCache.get(filename);
}

/**
 * Sauvegarde un cache mémoire sur disque pour le fichier historique donné.
 * @param {string} filename Nom fichier historique
 */
async function flushCacheToDisk(filename) {
  await ensureHistoryDirExists();
  if (!historyCache.has(filename)) {
    log.warn(`[flushCacheToDisk] No cache found for file ${filename}, skipping flush`);
    return;
  }
  const data = historyCache.get(filename);
  if (!Array.isArray(data)) {
    log.error(`[flushCacheToDisk] Cache data for ${filename} is not an array - potential corruption`);
    return;
  }
  const filePath = path.join(historyBaseDir, filename);
  try {
    //log.info(`[flushCacheToDisk] Saving cache to disk for ${filename} at ${filePath} with ${data.length} entries`);
    await saveHistoryFile(filePath, data);
    //log.info(`[flushCacheToDisk] Successfully saved cache for ${filename}`);
  } catch (e) {
    log.error(`[flushCacheToDisk] Error saving cache for file ${filename}: ${e.message}`);
  }
}

/**
 * Sauvegarde tous les caches mémoire en fichiers historiques.
 */
async function flushAllCache() {
  const filenames = Array.from(historyCache.keys());
  //log.info(`[flushAllCache] Flushing all caches (${filenames.length} files)`);
  for (const filename of filenames) {
    await flushCacheToDisk(filename);
  }
  //log.info('[flushAllCache] All cache flushed successfully');
}

// Expression régulière pour les fichiers historique avec plage date
const DATE_REGEX = /^history-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * Parse en toute sécurité une entrée de date string ou Date() en Date UTC à minuit.
 * @param {string|Date|null} dateInput
 * @returns {Date} Date UTC minuit
 */
function parseDateInput(dateInput) {
  if (!dateInput) {
    log.warn('[parseDateInput] Date input is null or undefined, defaulting to today start');
    return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  }

  if (typeof dateInput === 'string') {
    return new Date(dateInput.slice(0, 10) + 'T00:00:00Z');
  } else if (dateInput instanceof Date) {
    return new Date(dateInput.toISOString().slice(0, 10) + 'T00:00:00Z');
  } else {
    log.warn('[parseDateInput] Unknown date input type, defaulting to today start');
    return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  }
}

/**
 * Formate une Date en chaîne ISO simple "YYYY-MM-DD"
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Recherche un fichier historique couvrant la date désirée,
 * ou crée un nouveau fichier couvrant 7 jours glissants depuis cette date.
 * @param {string|Date} dateStr Date ISO, string ou objet Date
 * @returns {string} Nom fichier trouvé ou créé
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

  // Pas de fichier existant, on crée le nouveau fichier sur 7 jours glissants
  const start = date;
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const newFile = `history-${formatDate(start)}_to_${formatDate(end)}.json`;
  //   log.info(`[historyCache] No existing file for date ${dateStr}, creating new file ${newFile}`);

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
