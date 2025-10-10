const WebSocket = require('ws');
const log = require('../utils/logger');
const { setupConnection } = require('./connections');
const clients = require('./clients'); // Import singleton clients
const poller = require('./poller');
const { archiveInactiveFlights } = require('../flightsManager');
const { config } = require('../config');
const fs = require('fs').promises;
const path = require('path');

let wss;

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

function setup(server) {
  if (wss) return wss;

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

  startPollingLoop(config.backend.pollingIntervalMs);

  setInterval(async () => {
    try {
      const updatedFiles = await archiveInactiveFlights();
      const timestamp = new Date().toISOString();
      if (updatedFiles && updatedFiles.length > 0) {
        log.info(`[${timestamp}] [websocket] Automatic archiving completed for files: ${updatedFiles.join(', ')}`);
      } else {
        log.debug(`[${timestamp}] [websocket] Automatic archiving: no flights archived`);
      }
    } catch (e) {
      log.error(`[websocket] Error during automatic archiving: ${e.message}`);
    }
  }, config.backend.archiveCheckIntervalMs);

  return wss;
}

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
