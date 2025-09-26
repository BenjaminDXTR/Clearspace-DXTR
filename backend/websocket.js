const WebSocket = require('ws');
const { log } = require('./utils/logger');
const { config } = require('./config');
const { fetchDroneData } = require('./graphqlClient');
const {
  loadHistory,
  saveHistory,
  addDetectionToHistory,
  flightsHistory,
  archiveInactiveFlights,
} = require('./flightsHistoryManager');

let wss = null;
const clients = new Set();

function broadcast(data) {
  const message = JSON.stringify(data);
  log(`[broadcast] Données envoyées à ${clients.size} client(s), taille: ${message.length} octets`);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        log('[broadcast] Message envoyé à un client WebSocket');
      } catch (e) {
        log(`[broadcast] Erreur envoi message WS client: ${e.message}`);
      }
    } else {
      log('[broadcast] Client WS non ouvert, message non envoyé');
    }
  });
}

async function pollDetectionMachine() {
  try {
    log('[pollDetectionMachine] Envoi requête drone vers machine distante');
    const data = await fetchDroneData();
    if (data?.data?.drone) {
      const drones = Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone];
      log(`[pollDetectionMachine] Drones reçus: ${drones.length}`);
      drones.forEach((drone) => {
        addDetectionToHistory(drone);
        log(`[pollDetectionMachine] Détection ajoutée id=${drone.id}, lastSeen=${new Date().toISOString()}`);
      });
      broadcast(drones);
    } else {
      log('[pollDetectionMachine] Pas de données drone dans la réponse');
    }
  } catch (error) {
    log(`[pollDetectionMachine] Exception attrapée: ${error.message}`);
  }
}

function setupWebSocket(server) {
  if (wss) {
    log('[setupWebSocket] Warning: serveur WebSocket déjà initialisé');
    return wss;
  }

  loadHistory();

  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    log('[ws] Client websocket connecté');
    clients.add(ws);

    try {
      ws.send(JSON.stringify(flightsHistory));
      log('[ws] Snapshot historique envoyé au client WS');
    } catch (e) {
      log(`[ws] Erreur envoi snapshot initial WS: ${e.message}`);
    }

    ws.on('message', (message) => {
      log(`[ws] Message reçu brut: ${message}`);
      try {
        const data = JSON.parse(message);
        log('[ws] Message JSON parsé:', data);
        if (data && data.id && Array.isArray(data.tracing)) {
          addDetectionToHistory(data);
          log(`[ws] Détection ajoutée via message WS id=${data.id}`);
          broadcast(data);
        } else {
          log(`[ws] Message WS invalide reçu, data: ${JSON.stringify(data)}`);
        }
      } catch (e) {
        log(`[ws] Message WS invalide JSON: ${e.message}`);
      }
    });

    ws.on('close', () => {
      log('[ws] Client websocket déconnecté');
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      log(`[ws] Erreur websocket client: ${err.message}`);
    });
  });

  setInterval(() => {
    log('[interval] Sauvegarde périodique de l’historique des vols');
    saveHistory();
  }, config.backend.websocketSaveIntervalMs);

  setInterval(() => {
    log('[interval] Polling de la machine distante pour nouvelles détections');
    pollDetectionMachine();
  }, 2000);

  setInterval(() => {
    log('[interval] Archivage automatique des vols inactifs');
    archiveInactiveFlights();
  }, 15000);

  return wss;
}

module.exports = { setupWebSocket, getWebSocketServer: () => wss };
