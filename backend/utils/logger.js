const { config } = require('../config');
const fs = require('fs');
const path = require('path');

const levels = ['error', 'warn', 'info', 'debug'];
const currentLevel = config.backend.logLevel ? config.backend.logLevel.toLowerCase() : 'info';
const currentIndex = levels.indexOf(currentLevel) >= 0 ? levels.indexOf(currentLevel) : 2; // défaut info

const logsDir = path.join(__dirname, '../../logs');
const logFilePath = path.join(logsDir, 'error.log');

// Création dossier logs s'il n'existe pas
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function baseLog(level, context, message, ...args) {
  if (levels.indexOf(level.toLowerCase()) <= currentIndex) {
    const now = new Date().toISOString();
    // Compose message avec contexte (incluant [BACK] ou [FRONT])
    const formattedMessage = `[${now}] [${level.toUpperCase()}] [${context}] ${message}`;
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
  error: (context, msg, ...args) => baseLog('error', context, msg, ...args),
  warn: (context, msg, ...args) => baseLog('warn', context, msg, ...args),
  info: (context, msg, ...args) => baseLog('info', context, msg, ...args),
  debug: (context, msg, ...args) => baseLog('debug', context, msg, ...args),
};

module.exports = log;
