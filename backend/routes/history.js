const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { config } = require('../config');
const { log } = require('../utils/logger');

const router = express.Router();
const historyDir = path.resolve(__dirname, '..', 'history');

// GET /history - liste fichiers
router.get('/', async (req, res) => {
  try {
    await fs.access(historyDir);
    let files = await fs.readdir(historyDir);
    files = files.filter(f => f.endsWith('.json')).sort();
    res.json(files);
  } catch (error) {
    log('error', `Erreur listing historiques: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

// GET /history/:filename - contenu fichier
router.get('/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;

    // Validation simple : nom doit être composé uniquement de chiffres/lettres, tirets, underscore ou points
    if (!/^[\w\-\.]+$/.test(filename) || !filename.endsWith('.json')) {
      return res.status(400).json({ error: 'Nom de fichier invalide' });
    }

    const filePath = path.join(historyDir, filename);
    await fs.access(filePath);

    const data = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(data);
    res.json(json);
  } catch (error) {
    log('error', `Erreur lecture historique ${req.params.filename}: ${error.message}`);
    res.status(500).json({ error: 'Erreur serveur interne' });
  }
});

module.exports = router;
