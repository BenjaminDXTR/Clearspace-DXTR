const log = require('../utils/logger');
const { saveFlightToHistory } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');
const { config } = require('../config');

async function updateTrace(update) {
  const { id, latitude, longitude, created_time } = update;

  if (!id) {
    log.warn('[updateTrace] Missing drone id, ignoring update');
    return;
  }

  if (!flightTraces.has(id)) {
    flightTraces.set(id, []);
    log.info(`[updateTrace] Created new trace array for drone ${id}`);
  }

  const trace = flightTraces.get(id);
  log.debug(`[updateTrace] Current trace length for drone ${id}: ${trace.length}`);

  if (typeof latitude === 'number' && typeof longitude === 'number' && created_time) {
    try {
      const createdTimestamp = new Date(created_time).getTime();
      const nowTimestamp = Date.now();
      const relativeTime = nowTimestamp - createdTimestamp;

      if (
        trace.length === 0 ||
        trace[trace.length - 1][0] !== latitude ||
        trace[trace.length - 1][1] !== longitude
      ) {
        trace.push([latitude, longitude, relativeTime]);
        log.debug(`[updateTrace] Added point to drone ${id}, total points in trace: ${trace.length}`);
      } else {
        log.debug(`[updateTrace] Duplicate point, not added for drone ${id}`);
      }
    } catch (e) {
      log.error(`[updateTrace] Error calculating relative time for drone ${id}: ${e.message}`);
    }
  } else {
    log.warn(`[updateTrace] Invalid coordinates or missing created_time for drone ${id}`);
  }

  log.debug(`[updateTrace] Trace snapshot for drone ${id}: ${JSON.stringify(trace.slice(-5))}`);

  if (config.backend.useTest) {
    try {
      const fullFlight = { ...update, trace: trace.slice(), type: 'live' };
      // Utiliser saveFlightToHistory pour une gestion correcte du flux archive
      await saveFlightToHistory(fullFlight);
      log.info(`[updateTrace] Saved flight during simulation for drone ${id}`);
    } catch (error) {
      log.error(`[updateTrace] Error saving drone ${id} in simulation: ${error.message}`);
    }
  }
}

module.exports = updateTrace;
