const { config } = require('../config');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const log = require('../utils/logger');

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

  // Mise à jour vols détectés en 'live'
  for (const flight of detectedFlights) {
    if (!flight.id) continue;

    const oldEntry = flightStates.get(flight.id);

    if (!oldEntry || oldEntry.state === 'local') {
      log.info(`[updateFlightStates] Nouveau vol détecté ou réapparu ${flight.id} -> live`);
      flightStates.set(flight.id, {
        lastSeen: new Date(flight.lastseen_time).getTime(),
        state: 'live',
        createdTime: flight.created_time,
        data: flight,
      });
    } else {
      flightStates.set(flight.id, {
        ...oldEntry,
        lastSeen: new Date(flight.lastseen_time).getTime(),
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

  // Gérer vols absents
  for (const [id, state] of flightStates.entries()) {
    if (!detectedIds.includes(id)) {
      if (state.state === 'local') {
        continue; // Ignorer vols locaux
      }

      const absenceDuration = now - state.lastSeen;
      log.debug(`[updateFlightStates] Vol ${id} absent depuis ${absenceDuration}ms, état actuel: ${state.state}`);

      if (state.state === 'live' && WAITING_THRESHOLD <= absenceDuration) {
        log.info(`[updateFlightStates] Vol ${id} absent, passage live -> waiting`);
        state.state = 'waiting';
        state.data.state = 'waiting'; // synchroniser état dans données
        state.lastSeen = now;
        flightStates.set(id, state);
        await saveFlightToHistory(state.data);
        notifyUpdate(state.data.created_time);
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
}

/**
 * Sauvegarde un vol dans l'historique, avec champ anchorState.
 * Par défaut, anchorState est toujours "none".
 * La mise à jour à "pending" ou "anchored" se fait par les autres fichiers (ancrages reçus).
 * @param {Object} flight
 */
async function saveFlightToHistory(flight) {
  try {
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

    const historyData = await loadHistoryToCache(filename);

    const now = Date.now();

    if (flight.state === 'live') {
      lastSeenMap.set(flight.id, now);
    }

    let idx = historyData.findIndex(f => f.id === flight.id && f.created_time === flight.created_time);
    if (idx === -1) {
      idx = historyData.length;
      historyData.push(flight);
    } else {
      historyData[idx] = { ...historyData[idx], ...flight };
    }

    // Initialiser anchorState à "none" par défaut sans modifier si déjà défini ailleurs
    if (typeof historyData[idx].anchorState === 'undefined') {
      historyData[idx].anchorState = 'none';
    }

    notifyUpdate(filename);
    await flushCacheToDisk(filename);

    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory, updateFlightStates, flightStates };
