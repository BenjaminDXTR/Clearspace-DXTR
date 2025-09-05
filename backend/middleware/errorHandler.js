/**
 * Middleware global de gestion des erreurs pour Express
 * Fournit une réponse JSON structurée et un log serveur formaté
 */

const { log } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  // Logs : en prod on évite le stack trace complet (sauf si LOG_LEVEL le permet)
  if (process.env.NODE_ENV === 'production') {
    log('error', `${req.method} ${req.originalUrl} → ${err.message} (HTTP ${statusCode})`);
  } else {
    log('error', `${req.method} ${req.originalUrl} → ${err.message}`, {
      status: statusCode,
      stack: err.stack,
    });
  }

  // Réponse JSON standardisée
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Erreur interne du serveur' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { errorStack: err.stack }),
  });
}

module.exports = errorHandler;
