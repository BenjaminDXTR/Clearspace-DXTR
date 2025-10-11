const express = require('express');
const cors = require('cors');
const http = require('http');

const log = require('./utils/logger');
const { config } = require('./config');
const { setup, stopPolling } = require('./websocket/websocket');
const { flushAllCache } = require('./flightsManager');

const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);

// Option TLS désactivée via variable env
if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log.warn('TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

// Configuration CORS, gestion JSON, routes API
app.use(cors({ origin: config.backend.corsOrigin }));
app.use(express.json({ limit: config.backend.maxJsonSize }));
app.use(apiRoutes);

// Gestion des erreurs et routes non trouvées
app.use(notFoundHandler);
app.use(errorHandler);

// Démarrage du serveur websocket
const wss = setup(server);

// Démarrer la simulation si activée dans la config
if (config.backend.useTestSim) {
  const simulation = require('./simulation');
  simulation.startSimulation();
}

let flushIntervalId;

/**
 * Configure les timers pour flush cache périodique.
 * (Archivage automatiques des vols inactifs supprimé car fonction manquante)
 */
function startIntervals() {
  // Flush cache toutes les 60s
  flushIntervalId = setInterval(async () => {
    try {
      await flushAllCache();
      log.info('[flushAllCache] Flush périodique OK');
    } catch (e) {
      log.error(`[flushAllCache] Erreur flush périodique : ${e.message}`);
    }
  }, 60000);
}

/**
 * Supprime les timers
 */
function clearIntervals() {
  if (flushIntervalId) clearInterval(flushIntervalId);
  flushIntervalId = null;
}

startIntervals();

/**
 * Gestion arrêt serveur propre (polling stoppé, cache flushé)
 */
async function gracefulShutdown() {
  log.info('Début arrêt serveur : arrêt polling, flush cache en cours...');
  try {
    await stopPolling();
    log.info('Polling arrêté avec succès');
  } catch (e) {
    log.error(`Erreur arrêt polling : ${e.message}`);
  }
  clearIntervals();
  try {
    await flushAllCache();
    log.info('Flush final du cache réussi');
  } catch (e) {
    log.error(`Erreur flush cache à l'arrêt : ${e.message}`);
  }
  server.close(() => {
    log.info('Serveur HTTP arrêté, sortie du process');
    process.exit(0);
  });

  // Forçage sortie après timeout en cas de blocage
  setTimeout(() => {
    log.warn('Forçage sortie process après timeout');
    process.exit(1);
  }, 5000);
}

// Capturer les signaux d'arrêt système
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Gestion des exceptions non interceptées
process.on('uncaughtException', err => {
  log.error(`uncaughtException: ${err.stack || err}`);
});

// Gestion des promesses rejetées non gérées
process.on('unhandledRejection', (reason) => {
  log.error(`unhandledRejection: ${reason.stack || reason}`);
});

// Démarre serveur HTTP
const port = config.backend.port || 3200;
server.listen(port, () => {
  log.info(`Backend DroneWeb démarré sur http://localhost:${port}`);
  log.info(`Config backend active: port=${port}, CORS origin=${config.backend.corsOrigin}, simulation=${config.backend.useTestSim}`);
});
