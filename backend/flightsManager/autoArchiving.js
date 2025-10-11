const path = require('path');
const log = require('../utils/logger');
const { config } = require('../config');
const {
    notifyUpdate,
    loadHistoryToCache,
    flushCacheToDisk,
} = require('./');
const { flightStates, saveFlightToHistory } = require('./flightsController'); // Import direct pour éviter undefined
const fs = require('fs').promises;

/**
 * Liste tous les fichiers historiques JSON dans le dossier historique
 * @returns {Promise<string[]>} Liste des noms de fichier historique
 */
async function getAllHistoryFiles() {
    const historyDir = path.resolve(__dirname, '../history');
    try {
        const files = await fs.readdir(historyDir);
        return files.filter(f => f.endsWith('.json'));
    } catch (e) {
        log.error(`[autoArchiving] Erreur lecture dossiers historique : ${e.message}`);
        return [];
    }
}

/**
 * Remplace dans tous les fichiers historiques tous les vols en état "live" ou "waiting" par "local"
 * Et synchronise la mémoire flightStates avec ces mises à jour.
 */
async function archiveAllLiveAndWaitingAsLocal() {
    log.info('[autoArchiving] Passage de tous les vols live/waiting en local');
    const files = await getAllHistoryFiles();

    for (const file of files) {
        const historyData = await loadHistoryToCache(file);
        let fileChanged = false;

        for (const flight of historyData) {
            if (flight.state === 'live' || flight.state === 'waiting') {
                flight.state = 'local';
                fileChanged = true;
                log.info(`[autoArchiving] Vol ${flight.id} dans ${file} passé en local`);
            }
        }

        if (fileChanged) {
            await flushCacheToDisk(file);
            notifyUpdate(file);
            log.info(`[autoArchiving] Fichier ${file} sauvegardé et notification envoyée`);
        }
    }
    await syncFlightStatesWithHistory();
}

/**
 * Synchronise la mémoire flightStates avec les fichiers historiques,
 * en s’assurant que l’état des vols locaux est bien pris en compte.
 */
async function syncFlightStatesWithHistory() {
    log.info('[autoArchiving] Synchronisation mémoire avec historique');
    const files = await getAllHistoryFiles();

    for (const file of files) {
        const historyData = await loadHistoryToCache(file);

        for (const flight of historyData) {
            flightStates.set(flight.id, {
                lastSeen: flight.lastseen_time ? new Date(flight.lastseen_time).getTime() : Date.now(),
                state: flight.state,
                createdTime: flight.created_time,
                data: flight,
            });
        }
    }
    log.info('[autoArchiving] Synchronisation mémoire terminée');
}

/**
 * Fonction à appeler au shutdown : archive en local tous les vols live ou waiting en mémoire
 */
async function archiveLiveFlightsOnShutdown() {
    log.info('[autoArchiving] Archivage des vols en mémoire au shutdown');

    const flightsToArchive = [];
    for (const [id, state] of flightStates.entries()) {
        if (state.state === 'live' || state.state === 'waiting') {
            state.state = 'local';
            state.data.state = 'local';
            flightsToArchive.push(state.data);
            flightStates.delete(id);
            log.info(`[autoArchiving] Vol ${id} passé à local en mémoire`);
        }
    }

    for (const flight of flightsToArchive) {
        await saveFlightToHistory(flight);
    }
    log.info('[autoArchiving] Archivage des vols en mémoire terminé');
}

module.exports = {
    archiveAllLiveAndWaitingAsLocal,
    archiveLiveFlightsOnShutdown,
    getAllHistoryFiles,
    syncFlightStatesWithHistory,
};
