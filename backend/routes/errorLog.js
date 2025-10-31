const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Middleware analyse requête POST JSON
router.use(express.json());

// POST /log-error : journaliser une erreur envoyée par frontend
router.post('/log-error', (req, res) => {
  const error = req.body;

  // Validation basique
  if (
    typeof error !== 'object' ||
    !error.message ||
    !error.severity ||
    !error.timestamp
  ) {
    return res.status(400).json({ error: 'Format de donnée incorrect' });
  }

  const logMessage = `[${error.timestamp}] [${error.severity.toUpperCase()}] ` +
    `${error.title ? error.title + ": " : ""}${error.message} (id=${error.id || "n/a"})`;

  // Utiliser logger centralisé
  if (error.severity === 'error') {
    log.error(logMessage);
  } else if (error.severity === 'warn' || error.severity === 'warning') {
    log.warn(logMessage);
  } else {
    log.info(logMessage);
  }

  // Réponse succès
  res.json({ status: 'OK', message: 'Erreur logguée avec succès' });
});

module.exports = router;
