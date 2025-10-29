const log = require('../utils/logger');

/**
 * Diffuse un message JSON sérialisé à tous les clients WebSocket ouverts.
 * @param {Object|Array} data - Données à envoyer.
 * @param {Set} clients - Ensemble des clients WebSocket.
 * @param {boolean} filterLocal - Si vrai, filtre les vols marqués 'local'
 */
function broadcast(data, clients, filterLocal = false) {
  let toSend = data;

  // Si data est un tableau (liste de vols), filtrer si demandé
  if (Array.isArray(toSend) && filterLocal) {
    toSend = toSend.filter(d => d && d.state !== 'local');
  }

  try {
    const message = JSON.stringify(toSend);
    // log.info(`[broadcast] Preparing broadcast to ${clients.size} clients, message size: ${message.length} bytes`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) {
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

    // log.info(`[broadcast] Broadcast complete: ${sentCount} sent, ${skippedCount} skipped`);
  } catch (err) {
    log.error(`[broadcast] JSON serialization error: ${err.message}`);
  }
}

module.exports = broadcast;
