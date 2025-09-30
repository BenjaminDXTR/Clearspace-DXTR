const { config } = require('../config');
const { getWeekPeriod } = require('./utils');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, flightTraces } = require('./state');
const { log } = require('../utils/logger');

/**
 * Sauvegarde un vol dans l'historique en respectant la session de vol live/local
 * avec gestion du timeout, mise à jour des traces en mémoire et archivage sur disque.
 * @param {Object} flight Données complètes du vol (id, created_time, trace, type...)
 * @returns {string} filename du fichier d'historique modifié
 */
async function saveFlightToHistory(flight) {
  try {
    if (!flight.id) {
      log('[saveFlightToHistory] flight.id manquant, abandon');
      throw new Error('flight.id est requis');
    }

    if (!flight.type) flight.type = 'live';

    // Détermination de la période hebdo et nom du fichier
    const period = getWeekPeriod(flight.created_time || new Date().toISOString());
    const filename = period.filename;
    log(`[saveFlightToHistory] Traitement vol drone ${flight.id} dans fichier : ${filename}`);

    // Chargement cache historique ou tableau vide
    const historyData = await loadHistoryToCache(filename);
    log(`[saveFlightToHistory] Cache chargé ${filename} : ${historyData.length} entrées`);

    const now = Date.now();
    const INACTIVE_TIMEOUT = config.backend.inactiveTimeoutMs;

    // Récupération du lastSeen pour ce drone
    const lastSeen = lastSeenMap.get(flight.id) || 0;
    // Recherche dans l'historique volatile la session live correspondante
    const liveIdx = historyData.findIndex(f => f.id === flight.id && f.type === 'live');

    let newSession = true;

    /**
     * Si une session live est trouvée et pas timeout dépassé,
     * on réutilise created_time pour continuité de session,
     * sinon on démarre une nouvelle session.
     */
    if (liveIdx !== -1 && (now - lastSeen) <= INACTIVE_TIMEOUT) {
      flight.created_time = historyData[liveIdx].created_time;
      newSession = false;
      log(`[saveFlightToHistory] Vol ${flight.id} session live conservée, created_time = ${flight.created_time}`);
    } else {
      // Timeout dépassé ou pas de session live : on supprime la trace en mémoire
      if (flightTraces.has(flight.id)) {
        flightTraces.delete(flight.id);
        log(`[saveFlightToHistory] Timeout ou nouvelle session, trace backend supprimée pour drone ${flight.id}`);
      }
      // Met à jour le type en local si ancien live timeout
      if (liveIdx !== -1) {
        historyData[liveIdx].type = 'local';
        log(`[saveFlightToHistory] Vol ${flight.id} ancien timeout, type changé à 'local'`);
      }
    }

    // Mise à jour du lastSeen pour vols "live"
    if (flight.type === 'live' && flight.id) {
      lastSeenMap.set(flight.id, Date.now());
    } else if (flight.type === 'local' && flight.id) {
      // Pour un vol local, on supprime lastSeen car terminé
      lastSeenMap.delete(flight.id);
      log(`[saveFlightToHistory] Vol ${flight.id} archivé (local), entry lastSeen supprimée`);
    }

    // Si created_time non présent on initialise la valeur courante
    if (!flight.created_time) {
      flight.created_time = new Date().toISOString();
    }

    // Ne pas vider la trace si elle existe déjà (nouveau session avec trace vide uniquement)
    if (newSession && (!flight.trace || flight.trace.length === 0)) {
      flight.trace = [];
      log(`[saveFlightToHistory] Nouvelle session avec trace vide pour drone ${flight.id}`);
    } else {
      log(`[saveFlightToHistory] Trace avec ${flight.trace.length} points conservée pour drone ${flight.id}`);
    }

    // Log trace complète échantillon
    log(`[saveFlightToHistory] Trace sample drone ${flight.id}: ${JSON.stringify(flight.trace?.slice(0, 5))}`);

    // Fusion ou création dans le fichier cache
    addOrUpdateFlightInFile(flight, historyData);
    log(`[saveFlightToHistory] Vol fusionné ou ajouté drone ${flight.id}, nb entrées fichier : ${historyData.length}`);

    // Ecriture finale sur disque
    await flushCacheToDisk(filename);
    log(`[saveFlightToHistory] Cache flushé disque pour fichier ${filename}`);

    // Notification websocket aux clients pour rafraichissement
    notifyUpdate(filename);
    log(`[saveFlightToHistory] Notifie mise à jour pour fichier ${filename}`);

    return filename;
  } catch (err) {
    log(`[saveFlightToHistory] Erreur : ${err.message}`);
    throw err;
  }
}

module.exports = { saveFlightToHistory };
