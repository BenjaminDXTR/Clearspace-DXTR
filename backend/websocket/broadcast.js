const log = require('../utils/logger');

/**
 * Diffuse un message JSON sérialisé à tous les clients WebSocket ouverts.
 * @param {Object} data - Données à envoyer.
 * @param {Set} clients - Ensemble des clients WebSocket.
 */
function broadcast(data, clients) {
  try {
    const message = JSON.stringify(data);
    log.info(`[broadcast] Sending message to ${clients.size} clients, size: ${message.length} bytes`);
    for (const ws of clients) {
      if (ws.readyState === 1) { // Vérifie si client prêt (OPEN)
        try {
          ws.send(message);
        } catch (err) {
          log.error(`[broadcast] WS send error to client: ${err.message}`);
        }
      }
    }
  } catch (err) {
    log.error(`[broadcast] JSON serialization error: ${err.message}`);
  }
}

module.exports = broadcast;
