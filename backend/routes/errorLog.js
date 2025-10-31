const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

router.use(express.json());

router.post('/', (req, res) => {
  const error = req.body;

  if (
    typeof error !== 'object' ||
    !error.message ||
    !error.severity ||
    !error.timestamp
  ) {
    return res.status(400).json({ error: 'Format de donnée incorrect' });
  }

  // Construire le message sans date ni prefixe contextuel, c'est dans logger
  const logMessage = `${error.title ? error.title + ": " : ""}${error.message} (id=${error.id || "n/a"})`;

  if (error.severity === 'error') {
    log.error('FRONT', logMessage);
  } else if (error.severity === 'warn' || error.severity === 'warning') {
    log.warn('FRONT', logMessage);
  } else {
    log.info('FRONT', logMessage);
  }

  res.json({ status: 'OK', message: 'Erreur logguée avec succès' });
});

module.exports = router;
