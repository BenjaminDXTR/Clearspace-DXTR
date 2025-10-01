const log = require('../utils/logger');

/**
 * Diffuse un message JSON sérialisé à tous les clients WebSocket ouverts.
 * @param {Object} data - Données à envoyer.
 * @param {Set} clients - Ensemble des clients WebSocket.
 */
function broadcast(data, clients, filterLocal = false) {
  let toSend = data;
  if (filterLocal && Array.isArray(data)) {
    toSend = data.filter(d => d.type !== 'local');
  }
  try {
    const message = JSON.stringify(toSend);
    log.info(`[broadcast] Sending message to ${clients.size} clients, size ${message.length} bytes`);
    for (const ws of clients) {
      if (ws.readyState === 1) {
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
