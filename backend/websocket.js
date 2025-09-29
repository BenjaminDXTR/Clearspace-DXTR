const WebSocket = require('ws');
const { log } = require('./utils/logger');
const { config } = require('./config');
const { fetchDroneData } = require('./graphqlClient');
const {
  saveFlightToHistory,
  archiveInactiveFlights,
} = require('./flightsHistoryManager');

const fs = require('fs').promises;
const path = require('path');

let wss = null;
const clients = new Set();

let pollingActive = true;
let isPolling = false;

const flightTraces = new Map();

/**
 * Envoie un message JSON à tous les clients WebSocket connectés.
 * @param {Object} data 
 */
function broadcast(data) {
  try {
    const message = JSON.stringify(data);
    log(`[broadcast] Envoi à ${clients.size} client(s), taille: ${message.length} octets`);
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (e) {
          log(`[broadcast] Erreur envoi message WS: ${e.message}`);
        }
      }
    });
  } catch (e) {
    log(`[broadcast] Erreur sérialisation message: ${e.message}`);
  }
}

/**
 * Notifie tous les clients de la mise à jour d'un fichier historique.
 * @param {string} filename 
 */
function notifyHistoryUpdate(filename) {
  try {
    const msg = JSON.stringify({ type: 'historyUpdate', filename });
    log(`[notifyHistoryUpdate] Propagation mise à jour historique: ${filename} à ${clients.size} client(s)`);
    let sentCount = 0;
    clients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg);
          sentCount++;
          log(`[notifyHistoryUpdate] Notification envoyée au client pour fichier: ${filename}`);
        } catch (e) {
          log(`[notifyHistoryUpdate] Erreur envoi notification WS: ${e.message}`);
        }
      }
    });
    log(`[notifyHistoryUpdate] Nombre total de notifications envoyées : ${sentCount}`);
  } catch (e) {
    log(`[notifyHistoryUpdate] Erreur générale: ${e.message}`);
  }
}

/**
 * Effectue un fetch avec retry exponentiel.
 * @param {Function} fetchFn 
 * @param {number} maxRetries 
 * @param {number} baseDelayMs 
 */
async function fetchWithRetry(fetchFn, maxRetries = 5, baseDelayMs = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      log(`[fetchWithRetry] Tentative ${attempt + 1}`);
      return await fetchFn();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      log(`[fetchWithRetry] Erreur tentative ${attempt}: ${err.message}. Réessai dans ${delay} ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Interroge la machine de détection, met à jour les traces et sauvegarde l'historique.
 */
async function pollDetectionMachine() {
  if (config.backend.useTestSim) {
    log('[pollDetectionMachine] Mode simulation activé, pas d’appel API');
    return;
  }
  if (isPolling) {
    log('[pollDetectionMachine] Requête précédente active, skipping');
    return;
  }
  isPolling = true;
  try {
    log('[pollDetectionMachine] Démarrage requête API Drone');
    const data = await fetchWithRetry(fetchDroneData, 5, 1000);
    if (data?.data?.drone) {
      const drones = Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone];
      for (const drone of drones) {
        if (!flightTraces.has(drone.id)) {
          flightTraces.set(drone.id, []);
          log(`[pollDetectionMachine] Nouvelle trace créée pour vol ${drone.id}`);
        }
        const trace = flightTraces.get(drone.id);
        if (typeof drone.latitude === 'number' && typeof drone.longitude === 'number') {
          // Ajout du point s'il est différent du dernier
          if (trace.length === 0 || trace[trace.length - 1][0] !== drone.latitude || trace[trace.length - 1][1] !== drone.longitude) {
            trace.push([drone.latitude, drone.longitude]);
            log(`[pollDetectionMachine] Ajout coordonnées (${drone.latitude}, ${drone.longitude}) à trace vol ${drone.id} (total: ${trace.length})`);
          } else {
            log(`[pollDetectionMachine] Coordonnées identiques à précédentes pour vol ${drone.id}, pas ajout`);
          }
        } else {
          log(`[pollDetectionMachine] Coordonnées invalides pour vol ${drone.id}, pas ajout à la trace`);
        }
        drone.trace = trace;
        if (!drone.type) drone.type = "live";

        const historyFile = await saveFlightToHistory(drone);
        log(`[pollDetectionMachine] Vol ${drone.id} sauvegardé avec trace (${trace.length} points) dans ${historyFile}`);

        notifyHistoryUpdate(historyFile);
      }
      broadcast(drones);
      log(`[pollDetectionMachine] Broadcast des drones avec leurs traces`);
    } else {
      log('[pollDetectionMachine] Pas de données drone trouvées');
    }
  } catch (error) {
    log(`[pollDetectionMachine] Erreur : ${error.message}`);
  } finally {
    isPolling = false;
    log('[pollDetectionMachine] Fin de la requête API Drone');
  }
}

/**
 * Met à jour la trace d’un vol appelé par la simulation.
 * Sauvegarde en mode simulation avec gestion timeout dans saveFlightToHistory.
 */
async function updateFlightTrace(droneUpdate) {
  const { id, latitude, longitude, created_time } = droneUpdate;
  if (!flightTraces.has(id)) {
    flightTraces.set(id, []);
    log(`[updateFlightTrace] Nouvelle trace créée pour vol ${id}`);
  }
  const trace = flightTraces.get(id);

  // Ajoute seulement si position différente du dernier point
  if (typeof latitude === 'number' && typeof longitude === 'number') {
    if (trace.length === 0 || trace[trace.length - 1][0] !== latitude || trace[trace.length - 1][1] !== longitude) {
      trace.push([latitude, longitude]);
      log(`[updateFlightTrace] Ajout coordonnées (${latitude}, ${longitude}) à trace vol ${id} (total: ${trace.length})`);
    } else {
      log(`[updateFlightTrace] Coordonnées identiques au dernier point, pas d'ajout pour vol ${id}`);
    }
  } else {
    log(`[updateFlightTrace] Coordonnées invalides pour vol ${id}, pas ajout à la trace`);
  }
  
  if (config.backend.useTestSim) {
    try {
      const fullFlight = {
        ...droneUpdate,
        trace: trace.slice(),
        type: "live"
      };
      const historyFile = await saveFlightToHistory(fullFlight);
      log(`[updateFlightTrace] Vol ${id} sauvegardé avec trace (${trace.length} points) dans ${historyFile} (simulation)`);
      notifyHistoryUpdate(historyFile);
    } catch (e) {
      log(`[updateFlightTrace] Erreur sauvegarde vol ${id} en simulation : ${e.message}`);
    }
  }
}

/**
 * Démarre la boucle de polling (mode réel).
 */
async function startPollingLoop() {
  log('[startPollingLoop] Démarrage boucle polling');
  while (pollingActive) {
    await pollDetectionMachine();
    await new Promise(r => setTimeout(r, config.backend.pollingIntervalMs));
  }
  log('[startPollingLoop] Boucle polling arrêtée');
}

/**
 * Arrête la boucle de polling.
 */
function stopPolling() {
  log('[stopPolling] Arrêt de la boucle polling demandé');
  pollingActive = false;
}

/**
 * Initialise le serveur WebSocket et gère les connexions.
 * @param {*} server Instance HTTP server
 * @returns {WebSocket.Server} Serveur WebSocket
 */
function setupWebSocket(server) {
  if (wss) {
    log('[setupWebSocket] WS déjà initialisé');
    return wss;
  }

  wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws) => {
    log('[ws] Client WebSocket connecté');
    clients.add(ws);

    try {
      const historyDir = path.resolve(__dirname, 'history');
      await fs.access(historyDir);
      const files = await fs.readdir(historyDir);
      const summaries = files
        .filter(f => f.endsWith('.json'))
        .map(f => ({ filename: f }))
        .sort();
      log(`[ws] Envoi résumé historique (${summaries.length} fichiers) au client`);
      ws.send(JSON.stringify({ type: 'historySummaries', data: summaries }));
    } catch (e) {
      log(`[ws] Erreur envoi historiques: ${e.message}`);
      ws.send(JSON.stringify({ type: 'historySummaries', data: [] }));
    }

    ws.send(JSON.stringify([])); // snapshot vide initial

    ws.on('message', (message) => {
      log(`[ws] Message brut reçu: ${message}`);
      try {
        const data = JSON.parse(message);
        log('[ws] Message JSON parsé:', data);
        if (data && data.id && Array.isArray(data.trace)) {
          flightTraces.set(data.id, data.trace);
          log(`[ws] Trace mise à jour pour vol ${data.id} (${data.trace.length} points)`);

          saveFlightToHistory(data).then((historyFile) => {
            log(`[ws] Vol ${data.id} sauvegardé dans historique ${historyFile}`);
            notifyHistoryUpdate(historyFile);
          }).catch(e => {
            log(`[ws] Erreur sauvegarde vol ${data.id}: ${e.message}`);
          });

          broadcast(data);
          log(`[ws] Vol ${data.id} mis à jour via message WS`);
        } else {
          log(`[ws] Message WS invalide reçu: ${JSON.stringify(data)}`);
        }
      } catch (e) {
        log(`[ws] Erreur JSON message WS: ${e.message}`);
      }
    });

    ws.on('close', () => {
      log('[ws] Client WebSocket déconnecté');
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      log(`[ws] Erreur socket client: ${err.message}`);
    });
  });

  const { setUpdateFlightTrace } = require('./simulation');
  setUpdateFlightTrace(updateFlightTrace);

  if (!config.backend.useTestSim) {
    startPollingLoop();
  } else {
    log("[setupWebSocket] Mode simulation activé, boucle polling désactivée");
  }

  setInterval(() => {
    archiveInactiveFlights()
      .then(() => log('[interval] Archivage automatique vols inactifs OK'))
      .catch(e => log('[interval] Erreur archivage vols: ' + e.message));
  }, config.backend.archiveCheckIntervalMs);

  return wss;
}

module.exports = {
  setupWebSocket,
  getWebSocketServer: () => wss,
  broadcast,
  stopPolling,
  notifyHistoryUpdate,
  updateFlightTrace,
};
