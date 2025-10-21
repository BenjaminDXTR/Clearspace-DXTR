const express = require('express');
const cors = require('cors');
const http = require('http');
const os = require('os');

const log = require('./utils/logger');
const { config } = require('./config');
const { setup } = require('./websocket/websocket');
const { flushAllCache, archiveAllLiveAndWaitingAsLocal } = require('./flightsManager');
const { gracefulShutdown, setServerAndIntervals } = require('./middleware/shutdownHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes = require('./routes');
const { retryPendingAnchors } = require('./services/retryPending');

const app = express();
const server = http.createServer(app);

// Export du serveur HTTP pour usage externe (ex: websocket)
module.exports = { server };

// ------------------------------------------
// Désactivation TLS si besoin (dev local)
if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log.warn('TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

// ------------------------------------------
// Configurer Express pour faire confiance au proxy (si utilisé)
app.set('trust proxy', true);

// ------------------------------------------
// Récupération des listes IPs et origines autorisées
const allowedIps = config.backend.allowedIps || [];
const allowedOrigins = config.backend.allowedOrigins || [];

// ------------------------------------------
// Middleware de filtrage IP client (accès backend et frontend) simple maison
if (allowedIps.length > 0) {
  app.use((req, res, next) => {
    const clientIpRaw = req.ip || req.connection.remoteAddress || '';
    const clientIp = clientIpRaw.startsWith('::ffff:') ? clientIpRaw.substring(7) : clientIpRaw;
    if (allowedIps.includes(clientIp)) {
      return next();
    }
    log.warn(`Accès refusé pour IP non autorisée : ${clientIp}`);
    res.status(403).set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8'
    }).send(`
      <h1>Accès refusé</h1>
      <p>Votre adresse IP (${clientIp}) n'est pas autorisée à accéder à cette application.</p>
    `);
  });
} else {
  log.info('Pas de filtrage IP activé (ALLOWED_IPS non défini)');
}

// ------------------------------------------
// Middleware CORS avec filtrage dynamique des origines et credentials
if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: function(origin, callback) {
      if (!origin) return callback(null, true); // requêtes sans origine (Postman, curl)
      try {
        const originUrl = new URL(origin);
        const originHost = originUrl.protocol + '//' + originUrl.hostname;
        if (allowedOrigins.includes(originHost)) {
          return callback(null, true);
        } else {
          log.warn(`Requête CORS bloquée pour origine : ${origin}`);
          return callback(new Error('Origine non autorisée par CORS'));
        }
      } catch {
        log.warn(`Origine CORS invalide : ${origin}`);
        return callback(new Error('Origine non autorisée par CORS'));
      }
    },
    credentials: true,
  }));
} else {
  app.use(cors({ origin: config.backend.corsOrigin, credentials: true }));
  log.info('Pas de restriction CORS appliquée (ALLOWED_ORIGINS non défini)');
}

// Middleware JSON parser avec taille max de requête
app.use(express.json({ limit: config.backend.maxJsonSize }));

// Routes API et middlewares génériques
app.use(apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

// ------------------------------------------
// Gestion des intervalles périodiques (flush cache, retry)
let flushIntervalId;
let retryIntervalId;

function startIntervals() {
  flushIntervalId = setInterval(async () => {
    try {
      await flushAllCache();
      log.info('[flushAllCache] Flush périodique OK');
    } catch (e) {
      log.error(`[flushAllCache] Erreur flush périodique : ${e.message}`);
    }
  }, 60000);

  const retryMs = (config.backend.retryIntervalMin || 5) * 60 * 1000;
  retryIntervalId = setInterval(async () => {
    log.info('Début tentative de renvoi des preuves en attente...');
    try {
      await retryPendingAnchors();
    } catch (e) {
      log.error(`Erreur lors du retry des preuves en attente : ${e.message}`);
    }
  }, retryMs);
}

function clearIntervals() {
  if (flushIntervalId) clearInterval(flushIntervalId);
  if (retryIntervalId) clearInterval(retryIntervalId);
  flushIntervalId = null;
  retryIntervalId = null;
}

// ------------------------------------------
// Obtention de l'IP locale (non loopback)
function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const ifaceName in ifaces) {
    const iface = ifaces[ifaceName];
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return 'localhost';
}

// ------------------------------------------
// Initialisation principale (async)
(async () => {
  try {
    // Archivage des données live et waiting au démarrage
    await archiveAllLiveAndWaitingAsLocal();
    log.info('[server] Archivage live/waiting -> local au démarrage OK');

    // Initialisation WebSocket avec serveur HTTP
    setup(server);

    // Lancement des intervalles périodiques
    startIntervals();

    // Injection des références serveur dans shutdownHandler
    setServerAndIntervals(server, clearIntervals);

    // Simulation si configurée
    if (config.backend.useTestSim) {
      const simulation = require('./simulation');
      simulation.startSimulation();
      log.info('[server] Simulation démarrée');
    }

    // Gestion des signaux pour shutdown propre
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

    // Logs erreurs non gérées
    process.on('uncaughtException', (err) => log.error(`uncaughtException: ${err.stack || err}`));
    process.on('unhandledRejection', (reason) => log.error(`unhandledRejection: ${reason.stack || reason}`));

    // Démarrage serveur HTTP sur toutes interfaces
    const port = config.backend.port || 3200;
    server.listen(port, '0.0.0.0', () => {
      const localIp = getLocalIp();
      log.info(`Backend DroneWeb démarré sur http://${localIp}:${port}`);
      log.info(`Config active: port=${port}, CORS origin=${config.backend.corsOrigin}, simulation=${config.backend.useTestSim}`);
    });
  } catch (e) {
    log.error(`[server] Erreur au démarrage : ${e.message}`);
    process.exit(1);
  }
})();
