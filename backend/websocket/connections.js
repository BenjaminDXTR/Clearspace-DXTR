const { log } = require('../utils/logger');
const broadcast = require('./broadcast');
const { saveFlight, notifyUpdate } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');

const clients = new Set();

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

function setupConnection(ws, clients) {
    clients.add(ws);
    log(`[connections] New client connected. Total clients: ${clients.size}`);

    ws.on('message', async message => {
        log(`[connections] Message received: ${message}`);

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
                    notifyUpdate(filename);
                    broadcast([data], clients);
                    log(`[connections] Broadcasted updated flight: ${data.id}`);
                } catch (e) {
                    log(`[connections] Error saving flight: ${e.message}`);
                }
            } else {
                log(`[connections] Invalid message data format: ${message}`);
            }
        } catch (e) {
            log(`[connections] JSON parse error: ${e.message}`);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        log(`[connections] Client disconnected. Total clients: ${clients.size}`);
    });

    ws.on('error', e => {
        log(`[connections] Client error: ${e.message}`);
    });
}

module.exports = {
    clients,
    flightTraces,
    setupConnection,
};
