/**
 * Middleware Express pour gérer les routes non trouvées (404).
 * - Doit être placé APRÈS toutes les routes déclarées
 * - Crée une erreur et la transmet au middleware global d'erreurs
 */

const { log } = require('../utils/logger');

function notFoundHandler(req, res, next) {
  log('warn', `404 ${req.method} ${req.originalUrl} depuis ${req.ip}`);

  res.status(404);
  const error = new Error(`Route non trouvée : ${req.method} ${req.originalUrl}`);
  next(error);
}

module.exports = notFoundHandler;
