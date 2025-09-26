const fs = require('fs');
const path = require('path');
const { log } = require('./utils/logger');
const { config } = require('./config');

// Chemin complet du fichier JSON d'historique des vols
const historyFilePath = path.resolve(__dirname, config.backend.flightsHistoryFile || 'flights_history.json');

// Stockage en mémoire de l'historique vols en cours
let flightsHistory = [];

// Durée d'inactivité (millisecondes) avant archivage automatique d'un vol
const INACTIVE_TIMEOUT = config.backend.websocketInactiveTimeoutMs || 60000;

/**
 * Charge l'historique depuis le fichier JSON sur disque.
 * Initialise la variable flightsHistory.
 * Log le résultat, gère les erreurs et absence de fichier.
 */
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

/**
 * Enregistre l'historique actuel (flightsHistory) dans le fichier JSON.
 * Log le début, succès ou erreur de l’opération.
 */
function saveHistory() {
  try {
    log(`[saveHistory] Sauvegarde de l’historique avec ${flightsHistory.length} vols`);
    fs.writeFileSync(historyFilePath, JSON.stringify(flightsHistory, null, 2));
    log('[saveHistory] Historique sauvegardé avec succès');
  } catch (e) {
    log(`[saveHistory] Erreur écriture fichier historique: ${e.message}`);
  }
}

/**
 * Calcule la distance Euclidienne entre 2 points [lat, lng].
 * Permet de filtrer les points proches.
 * @param {number[]} p1 [lat,lng]
 * @param {number[]} p2 [lat,lng]
 * @returns {number} distance
 */
function distanceLatLng(p1, p2) {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Ajoute une détection drone à l'historique en mémoire.
 * Si le vol est nouveau, il est ajouté.
 * Met à jour trace uniquement avec points distants d'au moins websocketMinDistance.
 * Met à jour lastSeen et reset archived pour vol actif.
 * Log chaque étape importante.
 * @param {Object} detection Données drone détecté {id, tracing: [[lat,lng],...]}
 */
function addDetectionToHistory(detection) {
  if (!detection.id || !Array.isArray(detection.tracing) || detection.tracing.length === 0) {
    log('[addDetectionToHistory] Détection invalide reçue: ' + JSON.stringify(detection).slice(0, 200));
    return;
  }

  // Recherche vol existant
  let flight = flightsHistory.find(f => f.id === detection.id);

  // Si nouveau vol, initialisation
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

  // Ajout de points distants uniquement
  detection.tracing.forEach(pt => {
    const lastPoint = flight.trace.length > 0 ? flight.trace[flight.trace.length - 1] : null;
    if (!lastPoint || distanceLatLng(lastPoint, pt) > (config.backend.websocketMinDistance || 0.0001)) {
      flight.trace.push(pt);
      log(`[addDetectionToHistory] Vol ${detection.id} point ajouté: (${pt[0]}, ${pt[1]})`);
    }
  });

  // Mise à jour des métadonnées temps et état
  flight.lastSeen = Date.now();
  flight.archived = false; // reset archivage car vol actif

  log(`[addDetectionToHistory] Vol ${detection.id} trace mise à jour, total points: ${flight.trace.length}`);
}

/**
 * Parcourt l'historique à la recherche des vols inactifs plus que INACTIVE_TIMEOUT.
 * Marque ces vols comme archivés et sauvegarde l’historique si au moins un vol archivé.
 * Log les vols archivés et la sauvegarde.
 */
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

// Intervalle périodique pour détecter et archiver vols inactifs
setInterval(() => {
  log('[interval] Archivage périodique lancé');
  archiveInactiveFlights();
}, 15000);

module.exports = {
  loadHistory,
  saveHistory,
  addDetectionToHistory,
  flightsHistory,
  archiveInactiveFlights
};
