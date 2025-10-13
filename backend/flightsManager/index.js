const { loadHistoryFile, saveHistoryFile } = require('./fileOperations');
const { saveFlightToHistory, updateFlightStates, flightStates } = require('./flightsController');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, flushAllCache, historyCache } = require('./historyCache');
const { lastSeenMap, createdTimeMap, flightTraces } = require('./state');
const { getWeekPeriod } = require('./utils'); 
const { notifyUpdate } = require('./notification');

// Import des fonctions d'archivage directement depuis le bon fichier
const {
  archiveAllLiveAndWaitingAsLocal,
  archiveLiveFlightsOnShutdown,
} = require('./autoArchiving');

module.exports = {
  // Gestion fichiers
  loadHistoryFile,
  saveHistoryFile,

  // Gestion historique vols
  saveFlightToHistory,
  updateFlightStates,
  flightStates,

  // Gestion session de vol
  addOrUpdateFlightInFile,

  // Cache historique vols
  loadHistoryToCache,
  flushCacheToDisk,
  flushAllCache,
  historyCache,

  // Etat partagé ou stockage en mémoire
  lastSeenMap,
  createdTimeMap,
  flightTraces,

  // Utilitaires
  getWeekPeriod,

  // Archivage
  archiveAllLiveAndWaitingAsLocal,
  archiveLiveFlightsOnShutdown,
};
