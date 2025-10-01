const log = require('../utils/logger');

function notFoundHandler(req, res, next) {
  log.warn(`404 ${req.method} ${req.originalUrl} depuis ${req.ip}`);

  res.status(404);
  const error = new Error(`Route non trouvée : ${req.method} ${req.originalUrl}`);
  next(error);
}

module.exports = notFoundHandler;
