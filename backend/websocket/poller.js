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
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

function getDetectedIds(drones) {
    return drones
        .filter(drone => drone.id && !(drone.data && Array.isArray(drone.data.drone) && drone.data.drone.length === 0))
        .map(drone => drone.id);
}

async function poller() {
    if (isPolling) {
        log.debug('[poller] Already polling, skipping cycle');
        return;
    }
    isPolling = true;

    log.info('[poller] Starting new poll cycle');

    try {
        let drones;

        if (config.backend.useTestSim) {
            const simulation = require('../simulation');
            const simData = await simulation.getCurrentSimulationData();
            drones = simData.data?.drone || [];
            log.info(`[poller] Simulation data retrieved: ${JSON.stringify(drones, null, 2)}`);
        } else {
            const data = await fetchWithRetry(fetchDroneData, 5, 1000);
            drones = data?.data?.drone
                ? Array.isArray(data.data.drone)
                    ? data.data.drone
                    : [data.data.drone]
                : [];
            log.info(`[poller] API data retrieved: ${JSON.stringify(drones, null, 2)}`);
        }

        const detectedIds = getDetectedIds(drones || []);
        log.info(`[poller] Detected drone IDs: ${detectedIds.join(', ')}`);

        log.info(`[poller] Before updateFlightStates - drones timestamps snapshot: ${JSON.stringify(
            drones.map(d => ({ id: d.id, created_time: d.created_time, lastseen_time: d.lastseen_time }))
        )}`);

        await updateFlightStates(drones || []);
        log.info('[poller] Flight states updated');

        if (!drones || drones.length === 0) {
            log.info('[poller] No drones detected, broadcasting empty list');
            broadcast([], clients, true);
            isPolling = false;
            return;
        }

        const fullDrones = [];

        for (const drone of drones) {
            if (drone.data && Array.isArray(drone.data.drone) && drone.data.drone.length === 0) {
                log.debug('[poller] Empty drone data detected, ignoring this drone');
                continue;
            }
            if (!drone.id) {
                log.warn('[poller] Drone without ID skipped');
                continue;
            }

            log.info(`[poller] Drone ${drone.id} timestamps: created_time=${drone.created_time}, lastseen_time=${drone.lastseen_time}`);

            // Mise à jour trace du vol
            log.info(`[poller] Mise à jour traces pour drone ${drone.id} avec created_time=${drone.created_time}`);
            await updateTrace(drone);

            const trace = flightTraces.get(drone.id) || [];
            log.info(`[poller] Trace length pour drone ${drone.id}: ${trace.length}`);

            const fullDroneData = {
                ...drone,
                trace,
                state: drone.state || 'live',
            };

            fullDrones.push(fullDroneData);

            log.info(`[poller] Avant sauvegarde historique pour drone ${drone.id} avec created_time=${drone.created_time}`);
            await saveFlightToHistory(fullDroneData, detectedIds);
            log.info(`[poller] Sauvegarde historique terminée pour drone ${drone.id}`);
        }

        // Pour chaque vol (live + waiting), enrichir avec la trace correspondant à l'id
        const flightsToBroadcast = Array.from(flightStates.values())
            .map(s => {
                const trace = flightTraces.get(s.data.id) || [];
                return {
                    ...s.data,
                    trace,
                };
            })
            .filter(f => f.state === 'live' || f.state === 'waiting');

        log.info(`[poller] Broadcasting ${flightsToBroadcast.length} drones (live + waiting)`);

        broadcast(flightsToBroadcast, clients, true);

    } catch (err) {
        log.error(`[poller] Error during polling: ${err.stack || err.message || err}`);
    } finally {
        isPolling = false;
        log.info('[poller] Poll cycle finished');
    }
}

module.exports = poller;
