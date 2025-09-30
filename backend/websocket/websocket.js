const WebSocket = require('ws');
const { log } = require('../utils/logger');
const { setupConnection, flightTraces, clients } = require('./connections');
const poller = require('./poller');
const updateTrace = require('./updateTrace');
const { archiveInactiveFlights } = require('../flightsManager');
const { notifyUpdate } = require('../flightsManager/notification'); // Import notification modifiée
const { config } = require('../config');
const fs = require('fs').promises;
const path = require('path');

let wss;

/**
 * Envoie un message JSON à tous les clients connectés, avec filtrage optionnel des vols locaux.
 * @param {Array|Object} data Données à envoyer.
 * @param {boolean} [filterLocal=false] Si true, filtre les vols type local.
 */
function broadcast(data, filterLocal = false) {
    let filteredData = data;
    if (filterLocal && Array.isArray(data)) {
        filteredData = data.filter(flight => flight.type !== 'local');
        log(`[broadcast] Filtering out ${data.length - filteredData.length} local flights from broadcast`);
    }
    const message = JSON.stringify(filteredData);
    for (const ws of clients) {
        if (ws.readyState === 1) { // WS.OPEN
            try {
                ws.send(message);
            } catch (err) {
                log(`[broadcast] Error sending to client: ${err.message}`);
            }
        }
    }
}

/**
 * Démarre une boucle de polling à intervalle régulier.
 * @param {number} intervalMs Intervalle en millisecondes.
 */
async function startPollingLoop(intervalMs) {
    while (true) {
        await poller();
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
}

/**
 * Configure et démarre le serveur websocket.
 * @param {http.Server} server Serveur HTTP.
 * @returns {WebSocket.Server} Instance WebSocket.
 */
function setup(server) {
    if (wss) return wss;

    wss = new WebSocket.Server({ server });

    wss.on('connection', async ws => {
        clients.add(ws);
        log(`[websocket] New client connected. Total clients: ${clients.size}`);
        setupConnection(ws, clients);

        // Envoi de la liste actuelle des fichiers historiques JSON au client
        try {
            const historyDir = path.resolve(__dirname, '../history');
            await fs.access(historyDir);
            const files = await fs.readdir(historyDir);
            const summaries = files
                .filter(f => f.endsWith('.json'))
                .map(f => ({ filename: f }))
                .sort();
            ws.send(JSON.stringify({ type: 'historySummaries', data: summaries }));
            log('[websocket] Sent initial history summaries to client');
        } catch (e) {
            ws.send(JSON.stringify({ type: 'historySummaries', data: [] }));
            log(`[websocket] Error sending history summaries: ${e.message}`);
        }

        // Envoi d'un snapshot vide initial pour préparation affichage frontend
        ws.send(JSON.stringify([]));
    });

    // Démarrer le polling régulier même en mode simulation
    startPollingLoop(config.backend.pollingIntervalMs);

    // Intervalle d'archivage automatique des vols inactifs
    setInterval(async () => {
        try {
            const updatedFiles = await archiveInactiveFlights(filename => {
                if (filename) {
                    notifyUpdate(filename);
                    log(`[websocket] Notified update for archived file: ${filename}`);
                }
            });
            if (updatedFiles && updatedFiles.length > 0) {
                log('[websocket] Automatic archiving completed for files:', updatedFiles.join(', '));
            } else {
                log('[websocket] Automatic archiving: no flights archived');
            }
        } catch (e) {
            log(`[websocket] Error during automatic archiving: ${e.message}`);
        }
    }, config.backend.archiveCheckIntervalMs);

    return wss;
}

/**
 * Arrête polling et ferme serveur websocket.
 */
function stopPolling() {
    if (wss) {
        wss.close();
        wss = null;
    }
    clients.clear();
    log('[websocket] Polling stopped and server closed.');
}

module.exports = {
    setup,
    stopPolling,
    broadcast,
    notifyUpdate,
    updateTrace,
};
