const { config } = require('../config');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const log = require('../utils/logger');

const WAITING_THRESHOLD = 0;
const LOCAL_THRESHOLD = config.backend.inactiveTimeoutMs;

const flightStates = new Map();

async function updateFlightStates(detectedFlights) {
  const now = Date.now();
  const detectedIds = detectedFlights.map(f => f.id);

  for (const flight of detectedFlights) {
    if (!flight.id) {
      log.warn('[updateFlightStates] Vol sans id ignoré');
      continue;
    }

    const oldEntry = flightStates.get(flight.id);

    // Charger historique
    const filename = await findOrCreateHistoryFile(flight.created_time);
    const historyData = await loadHistoryToCache(filename);

    // Sessions waiting/live pour ce vol
    const sessions = historyData.filter(s => s.id === flight.id && (s.state === 'waiting' || s.state === 'live'));

    // Fusion traces + oldest created_time
    let mergedTrace = [];
    let oldestCreatedTime = flight.created_time;
    sessions.forEach(s => {
      if (Array.isArray(s.trace)) mergedTrace = mergedTrace.concat(s.trace);
      if (new Date(s.created_time) < new Date(oldestCreatedTime)) oldestCreatedTime = s.created_time;
    });
    mergedTrace.sort((a, b) => a[2] - b[2]);

    log.info(`[updateFlightStates] Vol ${flight.id} - fusion ${sessions.length} sessions, trace points: ${mergedTrace.length}`);

    // Reprise waiting -> live
    if (oldEntry && oldEntry.state === 'waiting' && flight.state === 'live') {
      const finalCreatedTime = new Date(oldestCreatedTime) < new Date(flight.created_time)
        ? oldestCreatedTime
        : flight.created_time;

      // Cle de session stable
      const consolidatedKey = `${flight.id}|${finalCreatedTime}`;
      const existingTrace = flightTraces.get(consolidatedKey) || [];

      // Ajout points nouveaux à trace existante
      const newPoints = mergedTrace.filter(
        p => !existingTrace.some(ep => ep[0] === p[0] && ep[1] === p[1] && ep[2] === p[2])
      );
      const updatedTrace = existingTrace.concat(newPoints).sort((a, b) => a[2] - b[2]);
      flightTraces.set(consolidatedKey, updatedTrace);

      // Mise à jour flightStates
      flightStates.set(flight.id, {
        lastSeen: new Date(flight.lastseen_time).getTime(),
        state: 'live',
        createdTime: finalCreatedTime,
        data: {
          ...flight,
          created_time: finalCreatedTime,
          trace: updatedTrace,
          state: 'live',
        },
      });

      await saveFlightToHistory(flightStates.get(flight.id).data);
      continue;
    }

    // Nouveau vol ou retour local
    if (!oldEntry || oldEntry.state === 'local') {
      flightStates.set(flight.id, {
        lastSeen: new Date(flight.lastseen_time).getTime(),
        state: 'live',
        createdTime: flight.created_time,
        data: {
          ...flight,
          state: 'live',
          trace: mergedTrace,
          created_time: flight.created_time,
        },
      });
      log.info(`[updateFlightStates] Nouveau ou retour vol ${flight.id} -> live`);
    } else {
      // Mise à jour live existant
      flightStates.set(flight.id, {
        ...oldEntry,
        lastSeen: new Date(flight.lastseen_time).getTime(),
        state: 'live',
        data: {
          ...flight,
          created_time: oldEntry.createdTime,
          trace: mergedTrace,
          state: 'live',
        },
      });
      if (oldEntry.state !== 'live') log.info(`[updateFlightStates] Vol ${flight.id} repasse en live depuis ${oldEntry.state}`);
    }

    log.debug(`[updateFlightStates] Vol ${flight.id} mis à jour, trace points: ${mergedTrace.length}`);

    await saveFlightToHistory(flightStates.get(flight.id).data);
  }


  // Traitement des vols absents actuellement
  for (const [id, state] of flightStates.entries()) {
    if (!detectedIds.includes(id)) {
      if (state.state === 'local') continue;
      const absenceDuration = now - state.lastSeen;
      log.debug(`[updateFlightStates] Vol ${id} absent depuis ${absenceDuration}ms, état : ${state.state}`);

      if (state.state === 'live' && WAITING_THRESHOLD <= absenceDuration) {
        log.info(`[updateFlightStates] Vol ${id} absent, passage live -> waiting`);
        state.state = 'waiting';
        state.data.state = 'waiting';
        state.lastSeen = now;
        flightStates.set(id, state);
        await saveFlightToHistory(state.data);
      } else if (state.state === 'waiting' && absenceDuration > LOCAL_THRESHOLD) {
        log.info(`[updateFlightStates] Vol ${id} en waiting depuis ${absenceDuration}ms, passage waiting -> local`);
        state.state = 'local';
        state.data.state = 'local';
        flightStates.set(id, state);
        const filename = await saveFlightToHistory(state.data);
        notifyUpdate(filename);
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
    log.info(`[saveFlightToHistory] Vol ${flight.id} sauvegardé avec état ${flight.state} dans fichier ${filename}`);
    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory, updateFlightStates, flightStates };
