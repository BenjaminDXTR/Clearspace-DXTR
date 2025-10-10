const { loadHistoryFile, saveHistoryFile } = require('./fileOperations');
const { saveFlightToHistory, archiveInactiveFlights, updateFlightStates } = require('./flightsController');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, flushAllCache, historyCache } = require('./historyCache');
const { lastSeenMap, createdTimeMap, flightTraces } = require('./state');
const { getWeekPeriod } = require('./utils'); // à créer si utils contient des fonctions utilitaires


module.exports = {
  // Gestion fichiers
  loadHistoryFile,
  saveHistoryFile,


  // Gestion historique vols
  saveFlightToHistory,
  updateFlightStates,
  archiveInactiveFlights,


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
};
