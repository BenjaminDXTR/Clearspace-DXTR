const fs = require('fs');
const path = require('path');
const { log } = require('./utils/logger');
const { config } = require('./config');

const historyFilePath = path.resolve(__dirname, config.backend.flightsHistoryFile || 'flights_history.json');
let flightsHistory = [];

const INACTIVE_TIMEOUT = config.backend.websocketInactiveTimeoutMs || 60000;

function loadHistory() {
  if (fs.existsSync(historyFilePath)) {
    try {
      const data = fs.readFileSync(historyFilePath, 'utf8');
      flightsHistory = JSON.parse(data);
      log(`[loadHistory] Historique chargé : ${flightsHistory.length} vols`);
    } catch (e) {
      log(`[loadHistory] Erreur chargement fichier historique: ${e.message}`);
      flightsHistory = [];
    }
  } else {
    log('[loadHistory] Aucun fichier historique trouvé, démarrage avec liste vide');
  }
}

function saveHistory() {
  try {
    log(`[saveHistory] Sauvegarde de l’historique avec ${flightsHistory.length} vols`);
    fs.writeFileSync(historyFilePath, JSON.stringify(flightsHistory, null, 2));
    log('[saveHistory] Historique sauvegardé avec succès');
  } catch (e) {
    log(`[saveHistory] Erreur écriture fichier historique: ${e.message}`);
  }
}

function distanceLatLng(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function addDetectionToHistory(detection) {
  if (!detection.id || !Array.isArray(detection.tracing) || detection.tracing.length === 0) {
    log('[addDetectionToHistory] Détection invalide reçue: ' + JSON.stringify(detection).slice(0, 200));
    return;
  }

  let flight = flightsHistory.find(f => f.id === detection.id);
  if (!flight) {
    flight = {
      id: detection.id,
      trace: [],
      created_time: detection.created_time || Date.now(),
      lastSeen: Date.now(),
      archived: false,
    };
    flightsHistory.push(flight);
    log(`[addDetectionToHistory] Nouveau vol ajouté: id=${detection.id}`);
  }

  detection.tracing.forEach(pt => {
    const lastPoint = flight.trace.length > 0 ? flight.trace[flight.trace.length - 1] : null;
    if (!lastPoint || distanceLatLng(lastPoint, pt) > (config.backend.websocketMinDistance || 0.0001)) {
      flight.trace.push(pt);
      log(`[addDetectionToHistory] Vol ${detection.id} point ajouté: (${pt[0]}, ${pt[1]})`);
    }
  });

  flight.lastSeen = Date.now();
  flight.archived = false;

  log(`[addDetectionToHistory] Vol ${detection.id} trace mise à jour, total points: ${flight.trace.length}`);
}

function archiveInactiveFlights() {
  const now = Date.now();
  let updated = false;

  flightsHistory.forEach(flight => {
    if (!flight.archived && flight.lastSeen && (now - flight.lastSeen) > INACTIVE_TIMEOUT) {
      flight.archived = true;
      log(`[archiveInactiveFlights] Vol ${flight.id} archivé après ${INACTIVE_TIMEOUT} ms d'inactivité`);
      updated = true;
    }
  });

  if (updated) {
    log('[archiveInactiveFlights] Vol(s) archivés détectés, sauvegarde de l’historique en cours');
    saveHistory();
  }
}

setInterval(() => {
  log('[interval] Archivage périodique lancé');
  archiveInactiveFlights();
}, 15000);

module.exports = { loadHistory, saveHistory, addDetectionToHistory, flightsHistory, archiveInactiveFlights };
