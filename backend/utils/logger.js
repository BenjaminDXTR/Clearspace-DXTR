const { config } = require('../config');
const fs = require('fs');
const path = require('path');

const levels = ['error', 'warn', 'info', 'debug'];
const currentLevel = config.backend.logLevel ? config.backend.logLevel.toLowerCase() : 'info';
const currentIndex = levels.indexOf(currentLevel) >= 0 ? levels.indexOf(currentLevel) : 2; // défaut info

const logsDir = path.join(__dirname, '../logs');
const logFilePath = path.join(logsDir, 'error.log');

// Création dossier logs s'il n'existe pas
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function baseLog(level, message, ...args) {
  if (levels.indexOf(level.toLowerCase()) <= currentIndex) {
    const now = new Date().toISOString();
    const formattedMessage = `[${now}] [${level.toUpperCase()}] ${message}`;
    console.log(formattedMessage, ...args);

    // Écrire dans fichier uniquement les erreurs (niveau "error")
    if (level === 'error') {
      const logLine = formattedMessage + (args.length ? ' ' + args.join(' ') : '') + '\n';
      fs.appendFile(logFilePath, logLine, (err) => {
        if (err) {
          console.error(`Erreur écriture fichier log : ${err.message}`);
        }
      });
    }
  }
}

const log = {
  error: (msg, ...args) => baseLog('error', msg, ...args),
  warn: (msg, ...args) => baseLog('warn', msg, ...args),
  info: (msg, ...args) => baseLog('info', msg, ...args),
  debug: (msg, ...args) => baseLog('debug', msg, ...args),
};

module.exports = log;
