const { config } = require('../config');
const { getWeekPeriod } = require('./utils');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const log = require('../utils/logger');

async function saveFlightToHistory(flight) {
  try {
    if (!flight.id) {
      log.error('[saveFlightToHistory] flight.id manquant, abandon');
      throw new Error('flight.id est requis');
    }

    if (!flight.type) flight.type = 'live';

    const period = getWeekPeriod(flight.created_time || new Date().toISOString());
    const filename = period.filename;
    log.info(`[saveFlightToHistory] Traitement vol drone ${flight.id} dans fichier : ${filename}`);

    const historyData = await loadHistoryToCache(filename);
    log.debug(`[saveFlightToHistory] Cache chargé ${filename} : ${historyData.length} entrées`);

    const now = Date.now();
    const INACTIVE_TIMEOUT = config.backend.inactiveTimeoutMs;

    const lastSeen = lastSeenMap.get(flight.id) || 0;
    const liveIdx = historyData.findIndex(f => f.id === flight.id && f.type === 'live');

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
      if (liveIdx !== -1) {
        historyData[liveIdx].type = 'local';
        log.warn(`[saveFlightToHistory] Vol ${flight.id} ancien timeout, type changé à 'local'`);
      }
    }

    if (flight.type === 'live' && flight.id) {
      lastSeenMap.set(flight.id, Date.now());
    } else if (flight.type === 'local' && flight.id) {
      lastSeenMap.delete(flight.id);
      log.info(`[saveFlightToHistory] Vol ${flight.id} archivé (local), entry lastSeen supprimée`);
    }

    if (!flight.created_time) {
      flight.created_time = new Date().toISOString();
    }

    if (newSession && (!flight.trace || flight.trace.length === 0)) {
      flight.trace = [];
      log.debug(`[saveFlightToHistory] Nouvelle session avec trace vide pour drone ${flight.id}`);
    } else {
      log.debug(`[saveFlightToHistory] Trace avec ${flight.trace.length} points conservée pour drone ${flight.id}`);
    }

    log.debug(`[saveFlightToHistory] Trace sample drone ${flight.id}: ${JSON.stringify(flight.trace?.slice(0, 5))}`);

    addOrUpdateFlightInFile(flight, historyData);
    log.info(`[saveFlightToHistory] Vol fusionné ou ajouté drone ${flight.id}, nb entrées fichier : ${historyData.length}`);

    await flushCacheToDisk(filename);
    log.info(`[saveFlightToHistory] Cache flushé disque pour fichier ${filename}`);

    notifyUpdate(filename);
    log.info(`[saveFlightToHistory] Notifie mise à jour pour fichier ${filename}`);

    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory };
