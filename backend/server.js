const express = require('express');
const cors = require('cors');
const http = require('http');

const log = require('./utils/logger');
const { config } = require('./config');
const { setup } = require('./websocket/websocket');
const { flushAllCache, archiveAllLiveAndWaitingAsLocal } = require('./flightsManager');
const { gracefulShutdown, setServerAndIntervals } = require('./middleware/shutdownHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);

// Export uniquement le serveur HTTP
module.exports = { server };

// Désactivation TLS si besoin (dev local)
if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log.warn('TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

// Middlewares
app.use(cors({ origin: config.backend.corsOrigin }));
app.use(express.json({ limit: config.backend.maxJsonSize }));
app.use(apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

// Gestion des intervalles
let flushIntervalId;

function startIntervals() {
  flushIntervalId = setInterval(async () => {
    try {
      await flushAllCache();
      log.info('[flushAllCache] Flush périodique OK');
    } catch (e) {
      log.error(`[flushAllCache] Erreur flush périodique : ${e.message}`);
    }
  }, 60000);
}

function clearIntervals() {
  if (flushIntervalId) clearInterval(flushIntervalId);
  flushIntervalId = null;
}

// Initialisation principale
(async () => {
  try {
    await archiveAllLiveAndWaitingAsLocal();
    log.info('[server] Archivage live/waiting -> local au démarrage OK');

    setup(server);

    startIntervals();

    setServerAndIntervals(server, clearIntervals);

    if (config.backend.useTestSim) {
      const simulation = require('./simulation');
      simulation.startSimulation();
      log.info('[server] Simulation démarrée');
    }

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    process.on('uncaughtException', err => log.error(`uncaughtException: ${err.stack || err}`));
    process.on('unhandledRejection', reason => log.error(`unhandledRejection: ${reason.stack || reason}`));

    const port = config.backend.port || 3200;
    server.listen(port, () => {
      log.info(`Backend DroneWeb démarré sur http://localhost:${port}`);
      log.info(`Config active: port=${port}, CORS origin=${config.backend.corsOrigin}, simulation=${config.backend.useTestSim}`);
    });
  } catch (e) {
    log.error(`[server] Erreur au démarrage : ${e.message}`);
    process.exit(1);
  }
})();
