const log = require('../utils/logger');
const broadcast = require('./broadcast');
const { fetchDroneData } = require('../graphqlClient');
const { saveFlightToHistory, updateFlightStates, flightStates } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');
const { clients } = require('./connections');
const updateTrace = require('./updateTrace');
const { config } = require('../config');

let isPolling = false;

async function fetchWithRetry(fn, retries = 5, delayMs = 1000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        log.error(`[poller] Retry exceeded. Last error: ${err.message}`);
        throw err;
      }
      log.warn(`[poller] Retry ${attempt} after error: ${err.message}. Waiting ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function getDetectedIds(drones) {
  return drones
    .filter(
      (drone) => drone.id && !(drone.data && Array.isArray(drone.data.drone) && drone.data.drone.length === 0)
    )
    .map((drone) => drone.id);
}

async function poller() {
  if (isPolling) {
    log.debug('[poller] Already polling, skipping cycle');
    return;
  }
  isPolling = true;

  try {
    let drones;

    if (config.backend.useTestSim) {
      const simulation = require('../simulation');
      const simData = await simulation.getCurrentSimulationData();
      drones = simData.data?.drone || [];
    } else {
      const data = await fetchWithRetry(fetchDroneData, 5, 1000);
      drones = data?.data?.drone
        ? Array.isArray(data.data.drone)
          ? data.data.drone
          : [data.data.drone]
        : [];
    }

    const detectedIds = getDetectedIds(drones || []);

    await updateFlightStates(drones || []);

    if (!drones || drones.length === 0) {
      broadcast([], clients, true);
      isPolling = false;
      return;
    }

    const fullDrones = [];

    for (const drone of drones) {
      if (drone.data && Array.isArray(drone.data.drone) && drone.data.drone.length === 0) {
        continue;
      }
      if (!drone.id) {
        log.warn('[poller] Drone without ID skipped');
        continue;
      }

      // Utiliser la clé createdTime consolidée issue de flightStates
      const oldState = flightStates.get(drone.id);
      const createdTime = oldState ? oldState.createdTime : drone.created_time;

      // Construire la clé unique pour la session
      const sessionKey = `${drone.id}|${createdTime}`;

      // Ajouter la clé consolidée à updateTrace
      const updateDroneForTrace = { ...drone, sessionEffective: sessionKey };

      await updateTrace(updateDroneForTrace);

      // Récupérer la trace consolidée dans flightTraces sous la clé stable
      const trace = flightTraces.get(sessionKey) || [];

      console.log(`[poller] Drone ID ${drone.id} state=${drone.state} trace length=${trace.length}`);


      const fullDroneData = {
        ...drone,
        trace,
        state: drone.state || 'live',
      };

      fullDrones.push(fullDroneData);

      await saveFlightToHistory(fullDroneData, detectedIds);
    }

    // Préparer la liste à diffuser vers frontend
    const flightsToBroadcast = Array.from(flightStates.values())
      .map((s) => {
        const key = `${s.data.id}|${s.createdTime}`;
        const trace = flightTraces.get(key) || [];
        return {
          ...s.data,
          trace,
        };
      })
      .filter((f) => f.state === 'live' || f.state === 'waiting');

    broadcast(flightsToBroadcast, clients, true);
  } catch (err) {
    log.error(`[poller] Error during polling: ${err.stack || err.message || err}`);
  } finally {
    isPolling = false;
  }
}

module.exports = poller;
