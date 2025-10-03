const log = require('../utils/logger');
const { config } = require('../config');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  // Log différent selon environnement et niveau
  if (config.backend.nodeEnv === 'production') {
    if (config.backend.logLevel === 'verbose') {
      log.error(`${req.method} ${req.originalUrl} → ${err.message}`, {
        status: statusCode,
        stack: err.stack,
      });
    } else {
      // Pour les erreurs internes, log spécial
      if (statusCode === 500) {
        log.error(`Erreur serveur critique sur ${req.method} ${req.originalUrl}: ${err.message}`);
      } else {
        log.error(`${req.method} ${req.originalUrl} → ${err.message} (HTTP ${statusCode})`);
      }
    }
  } else {
    // Mode dev, log complet en debug
    const detailedLog = {
      status: statusCode,
      stack: err.stack,
      headers: req.headers,
      params: req.params,
      query: req.query,
    };
    log.error(`${req.method} ${req.originalUrl} → ${err.message}`, detailedLog);
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Erreur interne du serveur' : err.message,
    ...(config.backend.nodeEnv !== 'production' && { errorStack: err.stack }),
  });
}

module.exports = errorHandler;
