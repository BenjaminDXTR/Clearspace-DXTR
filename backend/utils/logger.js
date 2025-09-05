const levels = ['error', 'warn', 'info', 'debug'];
const currentLevel = process.env.LOG_LEVEL || 'info';
const currentIndex = levels.indexOf(currentLevel.toLowerCase());

function log(level, message, ...args) {
  if (levels.indexOf(level.toLowerCase()) <= currentIndex) {
    console.log(`[${level.toUpperCase()}] ${message}`, ...args);
  }
}

module.exports = { log };
