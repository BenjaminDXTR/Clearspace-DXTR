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

function broadcast(data) {
  const message = JSON.stringify(data);
  log(`[broadcast] Envoi à ${clients.size} client(s), taille: ${message.length} octets`);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        log('[broadcast] Message WS envoyé à un client');
      } catch (e) {
        log(`[broadcast] Erreur envoi message WS: ${e.message}`);
      }
    } else {
      log('[broadcast] Client WS fermé, message non envoyé');
    }
  });
}

function notifyHistoryUpdate(filename) {
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
}


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
      log(`[fetchWithRetry] Erreur tentative ${attempt}: ${err.message}. Nouvel essai dans ${delay} ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}


async function pollDetectionMachine() {
  if (config.backend.useTestSim) {
    log('[pollDetectionMachine] Mode simulation activé, pas d’appel API');
    return;
  }
  if (isPolling) {
    log('[pollDetectionMachine] Requête précédente toujours en cours, skipping');
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
        if (Array.isArray(drone.points)) {
          flightTraces.get(drone.id).push(...drone.points);
          log(`[pollDetectionMachine] Ajout de ${drone.points.length} points à trace vol ${drone.id}`);
        } else {
          log(`[pollDetectionMachine] Pas de points pour vol ${drone.id}`);
        }

        // Bien mettre à jour la trace dans l'objet drone avant sauvegarde
        drone.trace = flightTraces.get(drone.id);

        if (!drone.type) drone.type = "live";

        const historyFile = await saveFlightToHistory(drone);
        log(`[pollDetectionMachine] Vol ${drone.id} sauvegardé avec trace (${flightTraces.get(drone.id).length} points) dans ${historyFile}`);

        notifyHistoryUpdate(historyFile);
      }

      broadcast(drones);
    } else {
      log('[pollDetectionMachine] Pas de données drone trouvées');
    }
  } catch (error) {
    log(`[pollDetectionMachine] Échec final : ${error.message}`);
  } finally {
    isPolling = false;
    log('[pollDetectionMachine] Fin de la requête API Drone');
  }
}


async function startPollingLoop() {
  log('[startPollingLoop] Démarrage boucle polling');
  while (pollingActive) {
    await pollDetectionMachine();
    await new Promise(r => setTimeout(r, config.backend.pollingIntervalMs));
  }
  log('[startPollingLoop] Boucle polling arrêtée');
}

function stopPolling() {
  log('[stopPolling] Arrêt de la boucle polling demandé');
  pollingActive = false;
}


function setupWebSocket(server) {
  if (wss) {
    log('[setupWebSocket] Attention : WS déjà initialisé');
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
      log(`[ws] Erreur envoi des historiques: ${e.message}`);
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
            log(`[ws] Vol ${data.id} sauvegardé dans l'historique ${historyFile}`);
            notifyHistoryUpdate(historyFile);
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

  startPollingLoop();

  setInterval(() => {
    archiveInactiveFlights()
      .then(() => log('[interval] Archivage automatique vols inactifs OK'))
      .catch(e => log('[interval] Erreur archivage vols: ' + e.message));
  }, config.backend.archiveCheckIntervalMs);

  return wss;
}

module.exports = { setupWebSocket, getWebSocketServer: () => wss, broadcast, stopPolling, notifyHistoryUpdate };
