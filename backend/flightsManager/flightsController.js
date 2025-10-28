const { config } = require('../config');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap } = require('./state');
const log = require('../utils/logger');

const WAITING_THRESHOLD = 0;
const LOCAL_THRESHOLD = config.backend.inactiveTimeoutMs;

const flightStates = new Map();

async function updateFlightStates(detectedFlights) {
  const now = Date.now();
  const detectedIds = detectedFlights.map(f => f.id);

  // Mise à jour vols détectés / live (pas de notification UI)
  for (const flight of detectedFlights) {
    if (!flight.id) continue;

    const oldEntry = flightStates.get(flight.id);

    if (!oldEntry || oldEntry.state === 'local') {
      log.info(`[updateFlightStates] Nouveau vol détecté ou réapparu ${flight.id} -> live`);
      flightStates.set(flight.id, {
        lastSeen: new Date(flight.lastseen_time).getTime(),
        state: 'live',
        createdTime: flight.created_time,
        data: { ...flight, state: 'live' },
      });
    } else {
      flightStates.set(flight.id, {
        ...oldEntry,
        lastSeen: new Date(flight.lastseen_time).getTime(),
        state: 'live',
        data: {
          ...flight,
          created_time: oldEntry.createdTime,
          state: 'live',
        },
      });
      if (oldEntry.state !== 'live') {
        log.info(`[updateFlightStates] Vol ${flight.id} repasse en live depuis état ${oldEntry.state}`);
      }
    }

    await saveFlightToHistory(flightStates.get(flight.id).data);
  }

  // Gestion vols absents; notification seulement au passage waiting -> local
  for (const [id, state] of flightStates.entries()) {
    if (!detectedIds.includes(id)) {
      if (state.state === 'local') continue;

      const absenceDuration = now - state.lastSeen;
      log.debug(`[updateFlightStates] Vol ${id} absent depuis ${absenceDuration}ms, état actuel : ${state.state}`);

      if (state.state === 'live' && WAITING_THRESHOLD <= absenceDuration) {
        log.info(`[updateFlightStates] Vol ${id} absent, passage live -> waiting`);
        state.state = 'waiting';
        state.data.state = 'waiting';
        state.lastSeen = now;

        flightStates.set(id, state);
        await saveFlightToHistory(state.data);
        // Pas de notifyUpdate ici, car passage waiting ne doit pas forcer UI
      } else if (state.state === 'waiting' && absenceDuration > LOCAL_THRESHOLD) {
        log.info(`[updateFlightStates] Vol ${id} en waiting depuis ${absenceDuration}ms, passage waiting -> local`);
        state.state = 'local';
        state.data.state = 'local';

        // Mettre à jour avant la sauvegarde pour cohérence
        flightStates.set(id, state);
        await saveFlightToHistory(state.data);

        notifyUpdate(state.data.created_time); // notify après la sauvegarde effective
        flightStates.delete(id);
      }
    }
  }
}

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

    const filename = await findOrCreateHistoryFile(flight.created_time);
    const historyData = await loadHistoryToCache(filename);

    if (flight.state === 'live') {
      lastSeenMap.set(flight.id, Date.now());
    }

    addOrUpdateFlightInFile(flight, historyData);

    const idx = historyData.findIndex(f => f.id === flight.id && f.created_time === flight.created_time);
    if (idx !== -1) {
      historyData[idx].state = flight.state;
      if (typeof historyData[idx].anchorState === 'undefined') {
        historyData[idx].anchorState = 'none';
      }
    }

    await flushCacheToDisk(filename);

    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory, updateFlightStates, flightStates };
