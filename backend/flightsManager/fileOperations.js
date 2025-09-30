const fs = require('fs').promises;
const path = require('path');
const { log } = require('../utils/logger');

async function loadHistoryFile(filePath) {
  try {
    await fs.access(filePath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      log(`[loadHistoryFile] File not found, returning empty array for ${filePath}`);
      return [];
    } else {
      log(`[loadHistoryFile] Error accessing ${filePath}: ${e.message}`);
      throw e;
    }
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(raw);
    log(`[loadHistoryFile] Loaded ${filePath} with ${data.length} entries`);
    return data;
  } catch (e) {
    log(`[loadHistoryFile] Error reading/parsing ${filePath}: ${e.message}`);
    throw e;
  }
}

async function saveHistoryFile(filePath, data) {
  if (!Array.isArray(data) || data.length === 0) {
    log(`[saveHistoryFile] Empty data, skipping save for ${filePath}`);
    return;
  }

  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    log(`[saveHistoryFile] Error creating directory ${dir}: ${e.message}`);
    throw e;
  }

  const tempFilePath = `${filePath}.tmp`;

  try {
    await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2));
    await fs.rename(tempFilePath, filePath);
    log(`[saveHistoryFile] Atomically saved ${filePath} with ${data.length} entries`);
  } catch (e) {
    log(`[saveHistoryFile] Error saving file ${filePath} atomically: ${e.message}`);
    throw e;
  }
}

module.exports = { loadHistoryFile, saveHistoryFile };
