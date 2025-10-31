const WebSocket = require('ws');

// Etat global du système avec valeurs par défaut
let systemStatus = {
  simulationMode: false,
  offlineMode: false,
  blockchainAccess: { ok: true, lastError: null },
  graphqlAccess: { ok: true, lastError: null },
};

// Référence au serveur WebSocket (à initialiser depuis websocket.js)
let wss = null;

/**
 * Initialise la référence WebSocket server
 * @param {WebSocket.Server} websocketServer 
 */
function setWebSocketServer(websocketServer) {
  wss = websocketServer;
}

/**
 * Met à jour le status système et diffuse aux clients
 * @param {Object} update - Clefs à mettre à jour dans systemStatus
 */
function updateSystemStatus(update) {
  systemStatus = { ...systemStatus, ...update };
  broadcastSystemStatus();
}

/**
 * Envoie la notification systemStatus à tous les clients WebSocket connectés
 */
function broadcastSystemStatus() {
  if (!wss) {
    console.warn('systemStatus: WebSocket server non initialisé, impossible de broadcast');
    return;
  }

  const message = JSON.stringify({ type: 'systemStatus', data: systemStatus });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Obtient le status système courant
 * @returns {Object}
 */
function getSystemStatus() {
  return systemStatus;
}

module.exports = {
  setWebSocketServer,
  updateSystemStatus,
  broadcastSystemStatus,
  getSystemStatus,
};
