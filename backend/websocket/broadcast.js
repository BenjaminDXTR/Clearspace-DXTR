const log = require('../utils/logger');

/**
 * Diffuse un message JSON sérialisé à tous les clients WebSocket ouverts.
 * @param {Object} data - Données à envoyer.
 * @param {Set} clients - Ensemble des clients WebSocket.
 */
function broadcast(data, clients, filterLocal = false) {
  let toSend = data;
  if (filterLocal && Array.isArray(data)) {
    toSend = data.filter(d => d.state !== 'local');
  }
  try {
    const message = JSON.stringify(toSend);
    log.info(`[broadcast] Preparing broadcast to ${clients.size} clients, message size ${message.length} bytes`);
    
    let sentCount = 0;
    let skippedCount = 0;
    
    for (const ws of clients) {
      if (ws.readyState === 1) {
        try {
          ws.send(message);
          sentCount++;
        } catch (err) {
          log.error(`[broadcast] WS send error to client: ${err.message}`);
        }
      } else {
        skippedCount++;
      }
    }
    
    log.info(`[broadcast] Broadcast complete: sent to ${sentCount}, skipped ${skippedCount} clients (not ready)`);
  } catch (err) {
    log.error(`[broadcast] JSON serialization error: ${err.message}`);
  }
}

module.exports = broadcast;
