const express = require('express');
const cors = require('cors');
const http = require('http');

const { log } = require('./utils/logger');
const { config } = require('./config');
const { setupWebSocket, stopPolling } = require('./websocket');
const { flushAllCache, archiveInactiveFlights } = require('./flightsHistoryManager');

const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();
const server = http.createServer(app);

if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log('warn', '⚠️ TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

app.use(cors({ origin: config.backend.corsOrigin }));
app.use(express.json({ limit: config.backend.maxJsonSize }));
app.use(apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const { broadcast } = require('./websocket');
const wss = setupWebSocket(server);

if (config.backend.useTestSim) {
  const { startTestSimulation, setBroadcast } = require('./simulation');
  setBroadcast(broadcast);
  startTestSimulation(2000);
}

let flushIntervalId;
let archiveIntervalId;

function startIntervals() {
  flushIntervalId = setInterval(() => {
    try {
      // flushAllCache is synchronous, but handle potential errors
      flushAllCache();
      log('[flushAllCache] Flush périodique OK');
    } catch (e) {
      log('[flushAllCache] Erreur flush périodique : ' + e.message);
    }
  }, 60000);

  archiveIntervalId = setInterval(() => {
    try {
      archiveInactiveFlights();
      log('[interval] Archivage automatique des vols inactifs OK');
    } catch (e) {
      log('[interval] Erreur archivage vols : ' + e.message);
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
  log('info', 'Arrêt serveur : arrêt polling, flush cache en cours...');
  try {
    stopPolling(); // Arrête le polling dans websocket.js
    clearIntervals(); // Nettoie les timers
    flushAllCache(); // Flush synchro
  } catch (e) {
    log('error', 'Erreur flush cache à l\'arrêt : ' + e.message);
  }
  server.close(() => {
    log('info', 'Serveur HTTP arrêté, sortie du process');
    process.exit(0);
  });

  // Force sortie après 5 secondes si jamais bloqué
  setTimeout(() => {
    log('warn', 'Forçage sortie process après timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

process.on('uncaughtException', err => {
  log('error', 'uncaughtException: ' + (err.stack || err));
});

process.on('unhandledRejection', (reason) => {
  log('error', 'unhandledRejection: ' + (reason.stack || reason));
});

const port = config.backend.port || 3200;
server.listen(port, () => {
  log('info', `✅ Backend DroneWeb démarré sur http://localhost:${port}`);
});
