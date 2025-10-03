const express = require('express');
const cors = require('cors');
const http = require('http');

const log = require('./utils/logger');
const { config } = require('./config');
const { setup, stopPolling } = require('./websocket/websocket');
const { flushAllCache, archiveInactiveFlights } = require('./flightsManager');

const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);

if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log.warn('⚠️ TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

app.use(cors({ origin: config.backend.corsOrigin }));
app.use(express.json({ limit: config.backend.maxJsonSize }));
app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const wss = setup(server);


if (config.backend.useTestSim) {
  const simulation = require('./simulation');
  simulation.startSimulation();
}

let flushIntervalId;
let archiveIntervalId;

function startIntervals() {
  flushIntervalId = setInterval(async () => {
    try {
      await flushAllCache();
      log.info('[flushAllCache] Flush périodique OK');
    } catch (e) {
      log.error(`[flushAllCache] Erreur flush périodique : ${e.message}`);
    }
  }, 60000);

  archiveIntervalId = setInterval(async () => {
    try {
      await archiveInactiveFlights();
      log.info('[interval] Archivage automatique vols inactifs OK');
    } catch (e) {
      log.error(`[interval] Erreur archivage vols : ${e.message}`);
    }
  }, config.backend.archiveCheckIntervalMs);
}

function clearIntervals() {
  if (flushIntervalId) clearInterval(flushIntervalId);
  if (archiveIntervalId) clearInterval(archiveIntervalId);
  flushIntervalId = null;
  archiveIntervalId = null;
}

startIntervals();


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

  setTimeout(() => {
    log.warn('Forçage sortie process après timeout');
    process.exit(1);
  }, 5000);
}


process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', err => {
  log.error(`uncaughtException: ${err.stack || err}`);
});

process.on('unhandledRejection', (reason) => {
  log.error(`unhandledRejection: ${reason.stack || reason}`);
});

const port = config.backend.port || 3200;
server.listen(port, () => {
  log.info(`✅ Backend DroneWeb démarré sur http://localhost:${port}`);
  log.info(`Config backend active: port=${port}, CORS origin=${config.backend.corsOrigin}, simulation=${config.backend.useTestSim}`);
});
