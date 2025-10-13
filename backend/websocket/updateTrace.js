const log = require('../utils/logger');
const { saveFlightToHistory } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');
const { config } = require('../config');

async function updateTrace(update) {
  const { id, latitude, longitude, created_time } = update;

  if (!id) {
    log.warn('[updateTrace] Missing drone id, skipping update');
    return;
  }

  if (!flightTraces.has(id)) {
    flightTraces.set(id, []);
    //log.info(`[updateTrace] Initialized new trace array for drone ${id}`);
  }

  const trace = flightTraces.get(id);

  if (typeof latitude === 'number' && typeof longitude === 'number' && created_time) {
    try {
      const createdTimestamp = new Date(created_time).getTime();
      const nowTimestamp = Date.now();
      const relativeTime = nowTimestamp - createdTimestamp;

      //log.info(`[updateTrace] Drone ${id} created_time UTC: ${created_time}, timestamp: ${createdTimestamp}, relativeTime: ${relativeTime} ms`);

      if (
        trace.length === 0 ||
        trace[trace.length - 1][0] !== latitude ||
        trace[trace.length - 1][1] !== longitude
      ) {
        trace.push([latitude, longitude, relativeTime]);
        //log.info(`[updateTrace] Point added for drone ${id}, total points: ${trace.length}, [lat, lng, relativeTime]: [${latitude}, ${longitude}, ${relativeTime}]`);
      } else {
        // Limiter ce log car redondant
        // log.debug(`[updateTrace] Duplicate point ignored for drone ${id}`);
      }
    } catch (e) {
      log.error(`[updateTrace] Error computing relative time for drone ${id}: ${e.message}`);
    }
  } else {
    log.warn(`[updateTrace] Invalid coordinates or missing created_time for drone ${id}`);
  }

  // Limiter fréquence d'affichage snapshot si trace très longue
  if (trace.length <= 10) {
    //log.debug(`[updateTrace] Trace snapshot for drone ${id}: ${JSON.stringify(trace)}`);
  } else if (trace.length % 10 === 0) {
    //log.info(`[updateTrace] Trace length for drone ${id} reached ${trace.length} points`);
    //log.debug(`[updateTrace] Trace snapshot tail: ${JSON.stringify(trace.slice(-5))}`);
  }

  if (config.backend.useTest) {
    try {
      const fullFlight = { ...update, trace: trace.slice(), state: 'live' };
      await saveFlightToHistory(fullFlight);
      //log.info(`[updateTrace] Saved flight in simulation for drone ${id}`);
    } catch (error) {
      log.error(`[updateTrace] Error saving drone ${id} in simulation: ${error.message}`);
    }
  }
}

module.exports = updateTrace;
