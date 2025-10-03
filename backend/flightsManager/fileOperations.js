const fs = require('fs').promises;
const path = require('path');
const log = require('../utils/logger');

async function loadHistoryFile(filePath) {
  try {
    await fs.access(filePath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      log.info(`[loadHistoryFile] File not found, returning empty array for ${filePath}`);
      return [];
    } else {
      log.error(`[loadHistoryFile] Error accessing file ${filePath}: ${e.message}`);
      throw e;
    }
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    log.info(`[loadHistoryFile] Loaded file ${filePath} with ${data.length} entries`);
    return data;
  } catch (e) {
    log.error(`[loadHistoryFile] Error reading or parsing file ${filePath}: ${e.message}`);
    throw e;
  }
}

async function saveHistoryFile(filePath, data) {
  if (!Array.isArray(data)) {
    log.error(`[saveHistoryFile] Attempted to save non-array data to file ${filePath}`);
    return;
  }
  if (data.length === 0) {
    log.info(`[saveHistoryFile] Empty data array, skipping save for file ${filePath}`);
    return;
  }

  log.info(`[saveHistoryFile] Saving data to file ${filePath} with ${data.length} entries`);

  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    log.error(`[saveHistoryFile] Error creating directory ${dir}: ${e.message}`);
    throw e;
  }

  const tempFilePath = `${filePath}.tmp`;

  try {
    await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2));
    await fs.rename(tempFilePath, filePath);
    log.info(`[saveHistoryFile] Atomically saved file ${filePath} with ${data.length} entries`);
  } catch (e) {
    log.error(`[saveHistoryFile] Error saving file atomically ${filePath}: ${e.message}`);
    throw e;
  }
}

module.exports = { loadHistoryFile, saveHistoryFile };
