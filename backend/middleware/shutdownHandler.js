const { stopPolling } = require('../websocket/websocket');
const { flushAllCache, archiveLiveFlightsOnShutdown } = require('../flightsManager');
const log = require('../utils/logger');

let serverInstance = null;
let flushIntervalsClear = null;

function setServerAndIntervals(server, clearIntervalsFn) {
  serverInstance = server;
  flushIntervalsClear = clearIntervalsFn;
}

/**
 * Fonction d’arrêt propre du serveur.
 */
async function gracefulShutdown() {
  log.info('Début arrêt serveur : arrêt polling, flush cache en cours...');
  
  try {
    await stopPolling();
    log.info('Polling arrêté avec succès');
  } catch (e) {
    log.error(`Erreur arrêt polling : ${e.message}`);
  }

  if (flushIntervalsClear) {
    try {
      flushIntervalsClear();
      log.info('Intervals de flush nettoyés');
    } catch (e) {
      log.error(`Erreur lors du nettoyage des intervals : ${e.message}`);
    }
  }

  try {
    await archiveLiveFlightsOnShutdown();
    log.info('[shutdownHandler] Archivage des vols en mémoire au shutdown OK');
  } catch (e) {
    log.error(`[shutdownHandler] Erreur archivage vols mémoire au shutdown : ${e.message}`);
  }

  try {
    await flushAllCache();
    log.info('Flush final du cache réussi');
  } catch (e) {
    log.error(`Erreur flush final cache à l\'arrêt : ${e.message}`);
  }

  if (serverInstance) {
    log.info('Fermeture serveur HTTP en cours...');
    serverInstance.close(() => {
      log.info('Serveur HTTP arrêté, sortie du process');
      process.exit(0);
    });
  } else {
    log.warn('serverInstance non défini lors de gracefulShutdown');
  }

  // Forçage sortie après timeout 5s (en cas de blocage)
  setTimeout(() => {
    log.warn('Forçage sortie process après timeout');
    process.exit(1);
  }, 5000);
}

module.exports = {
  gracefulShutdown,
  setServerAndIntervals,
};
