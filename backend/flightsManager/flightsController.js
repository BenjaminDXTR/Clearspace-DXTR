const { config } = require('../config');
const { getWeekPeriod } = require('./utils');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const log = require('../utils/logger');
const { checkIfAnchored } = require('../services/blockchainService'); // Import de la fonction d’interrogation blockchain


async function saveFlightToHistory(flight) {
  try {
    log.info(`[saveFlightToHistory] Début traitement vol id=${flight.id}, type=${flight.type || 'live'}`);

    if (!flight.id) {
      log.error('[saveFlightToHistory] flight.id manquant, abandon');
      throw new Error('flight.id est requis');
    }

    if (!flight.type) flight.type = 'live';

    const period = getWeekPeriod(flight.created_time || new Date().toISOString());
    const filename = period.filename;

    log.info(`[saveFlightToHistory] Traitement vol drone ${flight.id} dans fichier : ${filename}`);

    const historyData = await loadHistoryToCache(filename);
    log.info(`[saveFlightToHistory] Cache chargé pour ${filename} avec ${historyData.length} entrées`); 

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
      if (liveIdx !== -1 && historyData[liveIdx].type !== 'local') {
        // Passage en mode local détecté => vérifier isAnchored dans blockchain
        historyData[liveIdx].type = 'local';
        log.warn(`[saveFlightToHistory] Vol ${flight.id} ancien timeout, type changé en 'local'`);

        try {
          const anchored = await checkIfAnchored(flight.id, historyData[liveIdx].created_time);
          historyData[liveIdx].isAnchored = anchored;
          log.info(`[saveFlightToHistory] isAnchored mis à jour pour vol ${flight.id} : ${anchored}`);
        } catch (err) {
          log.error(`[saveFlightToHistory] Erreur checkIfAnchored pour vol ${flight.id} : ${err.message}`);
          historyData[liveIdx].isAnchored = false; // par sécurité, on marque non ancré en cas d'erreur
        }

        notifyUpdate(filename);
        log.info(`[saveFlightToHistory] Notification mise à jour envoyée pour fichier ${filename}`);
      }
    }

    if (flight.type === 'live') {
      lastSeenMap.set(flight.id, Date.now());
    } else if (flight.type === 'local') {
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

    addOrUpdateFlightInFile(flight, historyData);
    log.info(`[saveFlightToHistory] Vol drone ${flight.id} ajouté/fusionné dans ${filename} (total entrées: ${historyData.length})`);

    await flushCacheToDisk(filename);
    log.info(`[saveFlightToHistory] Cache sauvegardé sur disque pour fichier ${filename}`);

    return filename;
  } catch (err) {
    log.error(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory };
