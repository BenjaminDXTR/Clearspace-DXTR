const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { config } = require('../config');
const log = require('../utils/logger');

const router = express.Router();
const historyDir = path.resolve(__dirname, '..', 'history');

// GET /history - liste fichiers
router.get('/', async (req, res) => {
  try {
    await fs.access(historyDir);
    let files = await fs.readdir(historyDir);
    files = files.filter(f => f.endsWith('.json')).sort();
    res.json(files);
    log.info(`[history] Sent list of historical files (${files.length} files) to ${req.ip}`);
  } catch (error) {
    log.error(`[history] Error listing history files: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// GET /history/:filename - contenu fichier
router.get('/:filename', async (req, res) => {
  const filename = req.params.filename;

  // Validation simple du nom de fichier
  if (!/^[\w\-\.]+$/.test(filename) || !filename.endsWith('.json')) {
    log.warn(`[history] Invalid filename requested: ${filename} from IP ${req.ip}`);
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }

  const filePath = path.join(historyDir, filename);
  try {
    await fs.access(filePath);
    const data = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(data);
    res.json(json);
    log.info(`[history] Sent historical file content: ${filename} to ${req.ip}, entries count: ${json.length || 'unknown'}`);
  } catch (error) {
    log.error(`[history] Error reading historical file ${filename}: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

module.exports = router;
