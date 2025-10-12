const { config } = require('../config');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const log = require('../utils/logger');
const { checkIfAnchored } = require('../services/blockchainService');

// Seuils en ms
const WAITING_THRESHOLD = 0; // Passage immédiat à waiting si absent
const LOCAL_THRESHOLD = config.backend.inactiveTimeoutMs; // Exemple : 2 minutes avant archivage

// Map en mémoire des états des vols : id -> { lastSeen, state, createdTime, data }
const flightStates = new Map();

/**
 * Met à jour les états des vols et sauvegarde historique.
 * @param {Array} detectedFlights
 */
async function updateFlightStates(detectedFlights) {
  const now = Date.now();
  const detectedIds = detectedFlights.map(f => f.id);

  log.info(`[updateFlightStates] Démarrage mise à jour pour ${detectedIds.length} vols détectés`);

  // Mise à jour vols détectés en 'live'
  for (const flight of detectedFlights) {
    if (!flight.id) continue;

    const oldEntry = flightStates.get(flight.id);

    if (!oldEntry || oldEntry.state === 'local') {
      log.info(`[updateFlightStates] Nouveau vol détecté ou réapparu ${flight.id} -> live`);
      flightStates.set(flight.id, {
        lastSeen: new Date(flight.lastseen_time).getTime(), // lastseen_time reçu
        state: 'live',
        createdTime: flight.created_time,
        data: flight,
      });
    } else {
      flightStates.set(flight.id, {
        ...oldEntry,
        lastSeen: new Date(flight.lastseen_time).getTime(), // lastseen_time reçu
        state: 'live',
        data: {
          ...flight,
          created_time: oldEntry.createdTime,
        },
      });
      if (oldEntry.state !== 'live') {
        log.info(`[updateFlightStates] Vol ${flight.id} repasse en live depuis état ${oldEntry.state}`);
      }
    }

    log.info(`[updateFlightStates] Vol ${flight.id} créé à ${flightStates.get(flight.id).createdTime}`);

    await saveFlightToHistory(flightStates.get(flight.id).data);
  }

  // Gérer vols absents (live->waiting, waiting->local)
  for (const [id, state] of flightStates.entries()) {
    if (!detectedIds.includes(id)) {
      const absenceDuration = now - state.lastSeen;
      log.debug(`[updateFlightStates] Vol ${id} absent depuis ${absenceDuration}ms, état actuel: ${state.state}`);

      if (state.state === 'live' && WAITING_THRESHOLD <= absenceDuration) {
        log.info(`[updateFlightStates] Vol ${id} absent, passage live -> waiting`);
        state.state = 'waiting';
        state.data.state = 'waiting'; // synchroniser état dans données
        state.lastSeen = now;
        flightStates.set(id, state);
        await saveFlightToHistory(state.data);
        notifyUpdate(state.data.created_time); // notification au client
      } else if (state.state === 'waiting' && absenceDuration > LOCAL_THRESHOLD) {
        log.info(`[updateFlightStates] Vol ${id} en waiting depuis ${absenceDuration}ms, passage waiting -> local`);
        state.state = 'local';
        state.data.state = 'local'; // synchroniser état dans données
        flightStates.set(id, state);
        await saveFlightToHistory(state.data);
        notifyUpdate(state.data.created_time);
        flightStates.delete(id);
      }
    }
  }
  log.info('[updateFlightStates] Mise à jour des états terminée');
}

/**
 * Sauvegarde un vol dans l'historique.
 * @param {Object} flight
 */
async function saveFlightToHistory(flight) {
  try {
    log.info(`[saveFlightToHistory] Traitement vol id=${flight.id}, état=${flight.state || 'live'}`);

    if (!flight.id) {
      log.error('[saveFlightToHistory] flight.id manquant, abandon');
      throw new Error('flight.id est requis');
    }

    if (!flight.state) flight.state = 'live';

    if (!flight.created_time || isNaN(new Date(flight.created_time).getTime())) {
      log.warn(`[saveFlightToHistory] created_time invalide pour vol ${flight.id}, initialisé à maintenant`);
      flight.created_time = new Date().toISOString();
    }

    const filename = await findOrCreateHistoryFile(flight.created_time || new Date().toISOString());
    log.info(`[saveFlightToHistory] Vol drone ${flight.id} dans fichier : ${filename}`);

    const historyData = await loadHistoryToCache(filename);
    log.info(`[saveFlightToHistory] Cache chargé pour ${filename} avec ${historyData.length} entrées`);

    const now = Date.now();
    let fileChanged = false;

    if (flight.state === 'live') {
      lastSeenMap.set(flight.id, now);
    }

    const idx = historyData.findIndex(f => f.id === flight.id && f.created_time === flight.created_time);
    if (idx !== -1) {
      historyData[idx] = { ...historyData[idx], ...flight };
      log.info(`[saveFlightToHistory] Mise à jour vol ${flight.id} session dans cache`);
    } else {
      historyData.push(flight);
      log.info(`[saveFlightToHistory] Nouvelle session ajoutée vol ${flight.id} dans cache`);
    }
    fileChanged = true;

    if (flight.state === 'local') {
      try {
        const anchored = await checkIfAnchored(flight.id, flight.created_time);
        historyData[idx].isAnchored = anchored;
        log.info(`[saveFlightToHistory] isAnchored mis à jour pour vol ${flight.id}: ${anchored}`);
      } catch (err) {
        log.error(`[saveFlightToHistory] Erreur checkIfAnchored vol ${flight.id}: ${err.message}`);
        historyData[idx].isAnchored = false;
      }
      notifyUpdate(filename);
      log.info(`[saveFlightToHistory] Notification mise à jour envoyée pour fichier ${filename}`);
    }

    if (fileChanged) {
      await flushCacheToDisk(filename);
      log.info(`[saveFlightToHistory] Cache sauvegardé disque pour fichier ${filename}`);
    }

    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory, updateFlightStates, flightStates };
