const WebSocket = require('ws');
const log = require('../utils/logger');
const { setupConnection } = require('./connections');
const clients = require('./clients'); // Import singleton clients
const poller = require('./poller');
const { config } = require('../config');
const fs = require('fs').promises;
const path = require('path');

let wss;

/**
 * Envoi message JSON à tous clients connectés, option filtrage des vols locaux.
 * @param {Array|Object} data Données à envoyer (array ou objet)
 * @param {boolean} filterLocal Сacher vols en état 'local'
 */
function broadcast(data, filterLocal = false) {
  if (!clients || !(clients instanceof Set)) {
    log.error('[broadcast] clients Set undefined or invalid, aborting broadcast');
    return;
  }
  let filteredData = data;
  if (filterLocal && Array.isArray(data)) {
    filteredData = data.filter(flight => flight.state !== 'local');
    log.debug(`[broadcast] Filtering out ${data.length - filteredData.length} local flights from broadcast`);
  }
  try {
    const message = JSON.stringify(filteredData);
    log.info(`[broadcast] Sending message to ${clients.size} clients, size: ${message.length} bytes`);
    let clientIndex = 0;
    for (const ws of clients) {
      clientIndex++;
      if (ws.readyState === 1) {
        try {
          ws.send(message);
        } catch (err) {
          log.error(`[broadcast] Error sending to client #${clientIndex}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    log.error(`[broadcast] JSON serialization error: ${err.message}`);
  }
}

/**
 * Boucle infinie de polling pour récupérer et traiter les vols périodiquement.
 * @param {number} intervalMs Intervalle en ms
 */
async function startPollingLoop(intervalMs) {
  log.info(`[pollerLoop] Starting WebSocket poll loop with interval ${intervalMs} ms`);
  while (true) {
    try {
      await poller();
    } catch (err) {
      log.error(`[pollerLoop] Error during poll: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

/**
 * Initialise serveur WebSocket avec gestion des connexions client.
 * @param {http.Server} server Serveur HTTP attaché
 * @returns {WebSocket.Server} Instance serveur ws
 */
function setup(server) {
  if (wss) return wss; // Evite double initialisation

  wss = new WebSocket.Server({ server });
  log.info('[websocket] WebSocket server initialized');

  wss.on('connection', async ws => {
    clients.add(ws);
    log.info(`[websocket] New client connected. Total clients: ${clients.size}`);

    setupConnection(ws, broadcast);

    try {
      const historyDir = path.resolve(__dirname, '../history');
      await fs.access(historyDir);
      const files = await fs.readdir(historyDir);
      const summaries = files
        .filter(f => f.endsWith('.json'))
        .map(f => ({ filename: f }))
        .sort();
      ws.send(JSON.stringify({ type: 'historySummaries', data: summaries }));
      log.debug(`[websocket] Sent ${summaries.length} history summaries to client`);
    } catch (e) {
      ws.send(JSON.stringify({ type: 'historySummaries', data: [] }));
      log.warn(`[websocket] Error sending history summaries: ${e.message}`);
    }

    ws.send(JSON.stringify([]));
  });

  // Start the polling loop
  startPollingLoop(config.backend.pollingIntervalMs);

  return wss;
}

/**
 * Arrêt propre du serveur WebSocket et nettoyage des clients.
 */
function stopPolling() {
  if (wss) {
    wss.close();
    wss = null;
  }
  clients.clear();
  log.info('[websocket] Polling stopped and server closed.');
}

module.exports = {
  setup,
  stopPolling,
  broadcast,
};
