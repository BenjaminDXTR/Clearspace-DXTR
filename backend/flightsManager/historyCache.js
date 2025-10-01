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
  }
  return historyCache.get(filename);
}

async function flushCacheToDisk(filename) {
  await ensureHistoryDirExists();
  if (!historyCache.has(filename)) {
    log.warn(`[flushCacheToDisk] No cache found for file ${filename}`);
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
  for (const filename of historyCache.keys()) {
    await flushCacheToDisk(filename);
  }
  log.info('[flushAllCache] All cache flushed');
}

module.exports = { loadHistoryToCache, flushCacheToDisk, flushAllCache, historyCache };
