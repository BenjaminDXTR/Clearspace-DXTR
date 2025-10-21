const WebSocket = require('ws');
const log = require('../utils/logger');
const { setupConnection } = require('./connections');
const clients = require('./clients');
const poller = require('./poller');
const { config } = require('../config');
const fs = require('fs').promises;
const path = require('path');

let wss = null; // Instance WebSocket Server
let pollingActive = false;
let pollingPromise = null;

/**
 * Diffuse les données en broadcast aux clients WebSocket connectés
 * @param {Array} data Liste des données à transmettre
 * @param {boolean} filterLocal Filtrer les vols marqués comme 'local'
 */
function broadcast(data, filterLocal = false) {
  if (!(clients instanceof Set)) {
    log.error('[broadcast] clients Set undefined or invalid');
    return;
  }

  let filteredData = data;
  if (filterLocal && Array.isArray(data)) {
    filteredData = data.filter(flight => flight.state !== 'local');
  }

  try {
    const message = JSON.stringify(filteredData);
    log.info(`[broadcast] Sending message to ${clients.size} clients, message size: ${message.length} bytes`);

    let index = 0;
    for (const ws of clients) {
      index++;
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          log.error(`[broadcast] Error sending to client #${index}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    log.error(`[broadcast] JSON serialization error: ${err.message}`);
  }
}

/**
 * Boucle asynchrone continue de polling des données drones
 * @param {number} intervalMs Intervalle entre les cycles de polling en ms
 */
async function pollingLoop(intervalMs) {
  log.info(`[pollingLoop] Started with interval ${intervalMs}ms`);
  pollingActive = true;
  try {
    while (pollingActive) {
      try {
        await poller();
      } catch (err) {
        log.error(`[pollingLoop] Poller error: ${err.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    log.info('[pollingLoop] Stopped');
  } catch (fatal) {
    log.error(`[pollingLoop] Fatal error: ${fatal.message}`);
  }
}

/**
 * Démarre la boucle de polling si elle n'est pas déjà en cours
 * @param {number} intervalMs Intervalle entre chaque polling
 * @returns {Promise} La promise de la boucle de polling
 */
function startPollingLoop(intervalMs = 1000) {
  if (pollingPromise) {
    log.warn('[pollingLoop] Already running');
    return pollingPromise;
  }
  pollingPromise = pollingLoop(intervalMs);
  return pollingPromise;
}

/**
 * Arrête proprement le polling et ferme le serveur WebSocket
 */
async function stopPolling() {
  if (!pollingActive) {
    log.warn('[stopPolling] Polling not active');
    return;
  }
  pollingActive = false;

  if (wss) {
    wss.close();
    wss = null;
    log.info('[stopPolling] WebSocket server closed, wss set to null');
  }

  clients.clear();

  if (pollingPromise) {
    await pollingPromise;
    pollingPromise = null;
    log.info('[stopPolling] Polling loop promise resolved');
  }

  log.info('[stopPolling] Polling stopped');
}

/**
 * Initialise le serveur WebSocket attaché au serveur HTTP avec filtre IP
 * @param {http.Server} server Instance du serveur HTTP
 * @returns {WebSocket.Server} Instance du serveur WebSocket
 */
function setup(server) {
  if (wss) {
    log.info('[setup] WebSocket server already initialized');
    return wss;
  }

  wss = new WebSocket.Server({ server });
  log.info('[setup] WebSocket server initialized');

  wss.on('connection', async (ws, req) => {
    // Récupération IP client réelle avec prise en compte de proxy
    const clientIpRaw = req.socket.remoteAddress || '';
    const clientIp = clientIpRaw.startsWith('::ffff:') ? clientIpRaw.slice(7) : clientIpRaw;

    // Filtrage IP : rejet si IP non autorisée
    const allowedIps = config.backend.allowedIps || [];
    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      log.warn(`[connection] WebSocket connection refused: IP non autorisée ${clientIp}`);
      ws.close(1008, 'IP non autorisée'); // 1008 = Policy Violation
      return;
    }

    clients.add(ws);
    log.info(`[connection] New client connected from IP=${clientIp}, total clients: ${clients.size}`);

    setupConnection(ws, broadcast); // Mise en place gestion messages client

    try {
      const historyDir = path.resolve(__dirname, '../history');
      await fs.access(historyDir);
      const files = await fs.readdir(historyDir);
      const summaries = files.filter(f => f.endsWith('.json')).map(f => ({ filename: f })).sort();

      ws.send(JSON.stringify({ type: 'historySummaries', data: summaries }));
    } catch (err) {
      ws.send(JSON.stringify({ type: 'historySummaries', data: [] }));
      log.warn('[connection] Error sending history summaries: ' + err.message);
    }

    ws.send(JSON.stringify([]));
  });

  startPollingLoop(config.backend.pollingIntervalMs);

  return wss;
}

/**
 * Retourne la référence actuelle du serveur WebSocket
 * @returns {WebSocket.Server | null}
 */
function getWss() {
  return wss;
}

/**
 * Ferme toutes les connexions et le serveur WebSocket proprement
 * @returns {Promise<void>}
 */
function closeAllConnections() {
  return new Promise(resolve => {
    if (!wss) {
      log.info('[closeAllConnections] WebSocket server not initialized');
      resolve();
      return;
    }

    const clientCount = wss.clients.size;
    log.info(`[closeAllConnections] Closing ${clientCount} WebSocket clients`);

    wss.clients.forEach((client, index) => {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
          log.info(`[closeAllConnections] Client #${index + 1} closed`);
        }
      } catch (err) {
        log.error(`[closeAllConnections] Error closing client #${index + 1}: ${err.message}`);
      }
    });

    wss.close(() => {
      log.info('[closeAllConnections] WebSocket server closed');
      resolve();
    });
  });
}

module.exports = {
  setup,
  startPollingLoop,
  stopPolling,
  broadcast,
  closeAllConnections,
  getWss,
};
