const log = require('../utils/logger');

function notFoundHandler(req, res, next) {
  const timestamp = new Date().toISOString();
  const userAgent = req.get('user-agent') || 'Unknown UA';

  log.warn(`[${timestamp}] 404 Not Found: ${req.method} ${req.originalUrl} from IP ${req.ip} - UA: ${userAgent}`);

  res.status(404);
  const error = new Error(`Route non trouvée : ${req.method} ${req.originalUrl}`);
  next(error);
}

module.exports = notFoundHandler;
