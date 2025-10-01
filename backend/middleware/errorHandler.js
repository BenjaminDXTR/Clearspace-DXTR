const log = require('../utils/logger');
const { config } = require('../config');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const statusCode =
    res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500;

  if (config.backend.nodeEnv === 'production') {
    if (config.backend.logLevel === 'verbose') {
      log.error(`${req.method} ${req.originalUrl} → ${err.message}`, {
        status: statusCode,
        stack: err.stack,
      });
    } else {
      log.error(`${req.method} ${req.originalUrl} → ${err.message} (HTTP ${statusCode})`);
    }
  } else {
    // En dev, log complet incluant stacktrace
    log.error(`${req.method} ${req.originalUrl} → ${err.message}`, {
      status: statusCode,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Erreur interne du serveur' : err.message,
    ...(config.backend.nodeEnv !== 'production' && { errorStack: err.stack }),
  });
}

module.exports = errorHandler;
