const { config } = require('../config');

const levels = ['error', 'warn', 'info', 'debug'];
const currentLevel = config.backend.logLevel ? config.backend.logLevel.toLowerCase() : 'info';
const currentIndex = levels.indexOf(currentLevel) >= 0 ? levels.indexOf(currentLevel) : 2; // défaut info

function baseLog(level, message, ...args) {
  if (levels.indexOf(level.toLowerCase()) <= currentIndex) {
    const now = new Date().toISOString();
    console.log(`[${now}] [${level.toUpperCase()}] ${message}`, ...args);
  }
}

const log = {
  error: (msg, ...args) => baseLog('error', msg, ...args),
  warn: (msg, ...args) => baseLog('warn', msg, ...args),
  info: (msg, ...args) => baseLog('info', msg, ...args),
  debug: (msg, ...args) => baseLog('debug', msg, ...args),
};

module.exports = log;
