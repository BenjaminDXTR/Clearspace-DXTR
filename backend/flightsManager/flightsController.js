const { config } = require('../config');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const log = require('../utils/logger');
const { checkIfAnchored } = require('../services/blockchainService'); // Fonction d’interrogation blockchain

// Seuils en ms pour état waiting et local (à adapter)
const WAITING_THRESHOLD = 10000; // 10s attente avant passage en waiting
const LOCAL_THRESHOLD = config.backend.inactiveTimeoutMs; // ex : 2 min avant archivage

// Map en mémoire pour gérer état et dernier seen des vols
// Structure : id -> { lastSeen: timestamp, state: "live" | "waiting" | "local" }
const flightStates = new Map();

async function saveFlightToHistory(flight) {
  try {
    log.info(`[saveFlightToHistory] Début traitement vol id=${flight.id}, state=${flight.state || 'live'}`);

    if (!flight.id) {
      log.error('[saveFlightToHistory] flight.id manquant, abandon');
      throw new Error('flight.id est requis');
    }

    // Par défaut on considère le vol comme "live" si state non défini
    if (!flight.state) flight.state = 'live';

    // Chercher/creer fichier historique selon date de création vol
    const filename = await findOrCreateHistoryFile(flight.created_time || new Date().toISOString());
    log.info(`[saveFlightToHistory] Traitement vol drone ${flight.id} dans fichier : ${filename}`);

    // Charger cache historique
    const historyData = await loadHistoryToCache(filename);
    log.info(`[saveFlightToHistory] Cache chargé pour ${filename} avec ${historyData.length} entrées`);

    const now = Date.now();

    // Mise à jour flightStates : état et dernier seen
    if (flight.state === 'live' || !flight.state) {
      // Vol actif détecté : mise à jour état live et dernier seen
      flightStates.set(flight.id, { lastSeen: now, state: 'live' });
      flight.state = 'live'; // Forcer state
      lastSeenMap.set(flight.id, now);
    }

    // Traitement des vols connus non présents dans la détection courante
    for (const [id, state] of flightStates.entries()) {
      if (id !== flight.id) {
        const timeSinceLastSeen = now - state.lastSeen;

        // Passage de live à waiting après délai WAITING_THRESHOLD
        if (state.state === 'live' && timeSinceLastSeen > WAITING_THRESHOLD) {
          state.state = 'waiting';
          log.info(`[saveFlightToHistory] Vol ${id} passé en état 'waiting'`);
          // Mettre à jour dans le cache historique si besoin
          const idx = historyData.findIndex(f => f.id === id && f.state === 'live');
          if (idx !== -1) {
            historyData[idx].state = 'waiting';
          }
        }

        // Passage de waiting à local (archivé) après délai LOCAL_THRESHOLD
        if (state.state === 'waiting' && timeSinceLastSeen > LOCAL_THRESHOLD) {
          state.state = 'local';
          flightStates.delete(id);
          lastSeenMap.delete(id);
          log.info(`[saveFlightToHistory] Vol ${id} passé en état 'local'`);
          // Mettre à jour historique local
          const idx = historyData.findIndex(f => f.id === id && (f.state === 'live' || f.state === 'waiting'));
          if (idx !== -1) {
            historyData[idx].state = 'local';
            // Vérifier présence d'ancrage blockchain
            try {
              const anchored = await checkIfAnchored(id, historyData[idx].created_time);
              historyData[idx].isAnchored = anchored;
              log.info(`[saveFlightToHistory] isAnchored mis à jour pour vol ${id}: ${anchored}`);
            } catch (err) {
              log.error(`[saveFlightToHistory] Erreur checkIfAnchored pour vol ${id} : ${err.message}`);
              historyData[idx].isAnchored = false;
            }
            notifyUpdate(filename);
            log.info(`[saveFlightToHistory] Notification mise à jour envoyée pour fichier ${filename}`);
          }
        }
      }
    }

    // Appliquer l'état courant du vol dans l'objet avant sauvegarde
    if (flightStates.has(flight.id)) {
      flight.state = flightStates.get(flight.id).state;
    }

    // Gestion old session / nouvelle session
    const INACTIVE_TIMEOUT = config.backend.inactiveTimeoutMs;
    const lastSeen = lastSeenMap.get(flight.id) || 0;
    const liveIdx = historyData.findIndex(f => f.id === flight.id && f.state === 'live');
    let newSession = true;

    if (liveIdx !== -1 && (now - lastSeen) <= INACTIVE_TIMEOUT) {
      flight.created_time = historyData[liveIdx].created_time;
      newSession = false;
      log.info(`[saveFlightToHistory] Vol ${flight.id} session live conservée, created_time = ${flight.created_time}`);
    } else {
      if (flightTraces.has(flight.id)) {
        flightTraces.delete(flight.id);
        log.info(`[saveFlightToHistory] Timeout ou nouvelle session, trace backend supprimée pour drone ${flight.id}`);
      }

      if (liveIdx !== -1 && historyData[liveIdx].state !== 'local') {
        // Passage en mode local si pas déjà fait
        historyData[liveIdx].state = 'local';
        log.warn(`[saveFlightToHistory] Vol ${flight.id} ancien timeout, state changé en 'local'`);

        try {
          const anchored = await checkIfAnchored(flight.id, historyData[liveIdx].created_time);
          historyData[liveIdx].isAnchored = anchored;
          log.info(`[saveFlightToHistory] isAnchored mis à jour pour vol ${flight.id} : ${anchored}`);
        } catch (err) {
          log.error(`[saveFlightToHistory] Erreur checkIfAnchored pour vol ${flight.id} : ${err.message}`);
          historyData[liveIdx].isAnchored = false;
        }

        notifyUpdate(filename);
        log.info(`[saveFlightToHistory] Notification mise à jour envoyée pour fichier ${filename}`);
      }
    }

    // Enlever lastSeen pour vols archivés
    if (flight.state === 'local') {
      lastSeenMap.delete(flight.id);
      log.info(`[saveFlightToHistory] Vol ${flight.id} archivé, entrée lastSeen supprimée`);
    }

    if (!flight.created_time) {
      flight.created_time = new Date().toISOString();
      log.info(`[saveFlightToHistory] created_time initialisé à ${flight.created_time} pour drone ${flight.id}`);
    }

    if (newSession && (!flight.trace || flight.trace.length === 0)) {
      flight.trace = [];
      log.info(`[saveFlightToHistory] Nouvelle session avec trace vide pour drone ${flight.id}`);
    } else {
      log.info(`[saveFlightToHistory] Trace avec ${flight.trace.length} points conservée pour drone ${flight.id}`);
    }

    // Ajout ou mise à jour dans le fichier historique
    addOrUpdateFlightInFile(flight, historyData);
    log.info(`[saveFlightToHistory] Vol drone ${flight.id} ajouté/fusionné dans ${filename} (total entrées: ${historyData.length})`);

    // Sauvegarde cache sur disque
    await flushCacheToDisk(filename);
    log.info(`[saveFlightToHistory] Cache sauvegardé sur disque pour fichier ${filename}`);

    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory };
