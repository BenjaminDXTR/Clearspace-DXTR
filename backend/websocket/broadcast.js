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
    toSend = toSend.filter((d) => d && d.state !== 'local');
  }

  try {
    const message = JSON.stringify(toSend);

    // Log avant envoi : taille message et nombre clients ciblés
    log.info(`[broadcast] Preparing broadcast to ${clients.size} clients, message size: ${message.length} bytes`);

    // Log complet des données envoyées (troncature possible si trop volumineux)
    const dataPreview = message.length > 1000 ? message.substring(0, 1000) + '...[truncated]' : message;
    log.info(`[broadcast] Data sent preview: ${dataPreview}`);

    // Si c’est un tableau de vols, logger nombre total, live et waiting
    if (Array.isArray(toSend)) {
      const liveCount = toSend.filter((f) => f.state === 'live').length;
      const waitingCount = toSend.filter((f) => f.state === 'waiting').length;
      log.info(`[broadcast] Broadcasting ${toSend.length} flights (${liveCount} live, ${waitingCount} waiting)`);
    }

    let sentCount = 0;
    let skippedCount = 0;

    // Parcours les clients pour envoi si connectés
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

    // Log bilan post-envoi : combien reçus et combien ignorés
    log.info(`[broadcast] Broadcast completed: ${sentCount} sent, ${skippedCount} skipped`);
  } catch (err) {
    // Log erreur si la sérialisation JSON échoue
    log.error(`[broadcast] JSON serialization error: ${err.message}`);
  }
}

module.exports = broadcast;
