// flightsManager/index.js

const { loadHistoryFile, saveHistoryFile } = require('./fileOperations');
const { saveFlightToHistory, archiveInactiveFlights } = require('./flightsController');
const { addOrUpdateFlightInFile } = require('./flightSessions');
const { loadHistoryToCache, flushCacheToDisk, flushAllCache, historyCache } = require('./historyCache');
const { notifyUpdate } = require('./notification');
const { lastSeenMap, createdTimeMap, flightTraces } = require('./state');
const { getWeekPeriod } = require('./utils'); // à créer si utils contient des fonctions utilitaires

module.exports = {
  // Gestion fichiers
  loadHistoryFile,
  saveHistoryFile,

  // Gestion historique vols
  saveFlightToHistory,
  archiveInactiveFlights,

  // Gestion session de vol
  addOrUpdateFlightInFile,

  // Cache historique vols
  loadHistoryToCache,
  flushCacheToDisk,
  flushAllCache,
  historyCache,

  // Notification mises à jour
  notifyUpdate,

  // Etat partagé ou stockage en mémoire
  lastSeenMap,
  createdTimeMap,
  flightTraces,

  // Utilitaires
  getWeekPeriod,
};
