const log = require('../utils/logger');
const { saveFlightToHistory } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');
const { config } = require('../config');

/**
 * Met à jour la trace en mémoire pour une session de vol identifiée par une clé consolidée.
 * @param {Object} update Les données du drone, incluant id, latitude, longitude, created_time, et clé sessionEffective
 */
async function updateTrace(update) {
  const { id, latitude, longitude, created_time, sessionEffective } = update;

  if (!id) {
    log.warn('[updateTrace] Missing drone id, skipping update');
    return;
  }
  if (!created_time) {
    log.warn('[updateTrace] Missing created_time, skipping update');
    return;
  }

  // Utilisation de la clé consolidée si fournie
  const key = sessionEffective || `${id}|${created_time}`;

  if (!flightTraces.has(key)) {
    flightTraces.set(key, []);
    // log.info(`[updateTrace] Initialized new trace array for drone session ${key}`);
  }

  const trace = flightTraces.get(key);

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    try {
      const createdTimestamp = new Date(created_time).getTime();
      const nowTimestamp = Date.now();
      const relativeTime = Math.max(nowTimestamp - createdTimestamp, 0);

      // Eviter doublons dans la trace
      if (
        trace.length === 0 ||
        trace[trace.length - 1][0] !== latitude ||
        trace[trace.length - 1][1] !== longitude ||
        trace[trace.length - 1][2] !== relativeTime
      ) {
        trace.push([latitude, longitude, relativeTime]);
      }
    } catch (e) {
      log.error(`[updateTrace] Error computing relative time for drone session ${key}: ${e.message}`);
    }
  } else {
    log.warn(`[updateTrace] Invalid coordinates for drone session ${key}`);
  }

  // Limiter la taille pour éviter fuite mémoire
  const maxTraceLength = 1000;
  if (trace.length > maxTraceLength) {
    trace.splice(0, trace.length - maxTraceLength);
  }

  if (config.backend.useTest) {
    try {
      const fullFlight = { ...update, trace: trace.slice(), state: 'live' };
      await saveFlightToHistory(fullFlight);
    } catch (error) {
      log.error(`[updateTrace] Error saving drone ${id} in simulation: ${error.message}`);
    }
  }
}

module.exports = updateTrace;
