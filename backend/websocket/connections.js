const log = require('../utils/logger');
const broadcast = require('./broadcast');
const { saveFlight } = require('../flightsManager');
const flightTraces = require('../flightsManager/state').flightTraces;
const clients = require('./clients'); // Import singleton clients

function isValidTrace(trace) {
  if (!Array.isArray(trace)) return false;
  return trace.every(point =>
    Array.isArray(point) &&
    point.length === 3 &&
    typeof point[0] === 'number' &&
    typeof point[1] === 'number' &&
    typeof point[2] === 'number'
  );
}

function setupConnection(ws, broadcastFn) {
  clients.add(ws);
  log.info(`[connections] New client connected. Total clients: ${clients.size}`);

  ws.on('message', async message => {
    log.debug(`[connections] Message received: ${message}`);

    try {
      const data = JSON.parse(message);

      if (
        data &&
        typeof data.id === 'string' &&
        Array.isArray(data.trace) &&
        isValidTrace(data.trace)
      ) {
        flightTraces.set(data.id, data.trace);
        try {
          const filename = await saveFlight(data);
          broadcastFn([data], clients);
          log.info(`[connections] Broadcasted updated flight: ${data.id}`);
        } catch (e) {
          log.error(`[connections] Error saving flight: ${e.message}`);
        }
      } else {
        log.warn(`[connections] Invalid message data format: ${message}`);
      }
    } catch (e) {
      log.error(`[connections] JSON parse error: ${e.message}`);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    log.info(`[connections] Client disconnected. Total clients: ${clients.size}`);
  });

  ws.on('error', e => {
    log.error(`[connections] Client error: ${e.message}`);
  });
}

module.exports = {
  clients, // Export direct
  flightTraces,
  setupConnection,
};
