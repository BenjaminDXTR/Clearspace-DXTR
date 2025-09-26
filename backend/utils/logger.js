const { config } = require('../config');

const levels = ['error', 'warn', 'info', 'debug'];
const currentLevel = config.backend.logLevel ? config.backend.logLevel.toLowerCase() : 'info';
const currentIndex = levels.indexOf(currentLevel) >= 0 ? levels.indexOf(currentLevel) : 2; // défaut info

/**
 * Logger simple avec niveaux et propagation conditionnelle selon config.
 * @param {string} level - niveau du log : error, warn, info, debug
 * @param {string} message - message principal
 * @param  {...any} args - options supplémentaires, objets, erreurs, etc.
 */
function log(level, message, ...args) {
  if (levels.indexOf(level.toLowerCase()) <= currentIndex) {
    const now = new Date().toISOString();
    console.log(`[${now}] [${level.toUpperCase()}] ${message}`, ...args);
  }
}

module.exports = { log };
