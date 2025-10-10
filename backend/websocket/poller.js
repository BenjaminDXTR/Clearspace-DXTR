const log = require('../utils/logger');
const broadcast = require('./broadcast');
const { fetchDroneData } = require('../graphqlClient');
const { saveFlightToHistory, updateFlightStates } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');
const { clients } = require('./connections');
const updateTrace = require('./updateTrace');
const { config } = require('../config');
const { applyTimeOffset } = require('../utils/dateUtils');

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
            drones = await simulation.getCurrentSimulationData();
            //log.info(`[poller] Simulation data retrieved: ${JSON.stringify(drones, null, 2)}`);
        } else {
            const data = await fetchWithRetry(fetchDroneData, 5, 1000);
            drones = data?.data?.drone ? (Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone]) : [];
            log.info(`[poller] API data retrieved: ${JSON.stringify(drones, null, 2)}`);
        }

        const detectedIds = getDetectedIds(drones || []);
        log.info(`[poller] Detected drone IDs: ${detectedIds.join(', ')}`);

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

            if (drone.created_time) {
                drone.created_time = applyTimeOffset(drone.created_time, config.backend.timeOffsetHours);
                log.info(`[poller] Drone ${drone.id} created_time after offset: ${drone.created_time}`);
            }
            if (drone.lastseen_time) {
                drone.lastseen_time = applyTimeOffset(drone.lastseen_time, config.backend.timeOffsetHours);
                log.info(`[poller] Drone ${drone.id} lastseen_time after offset: ${drone.lastseen_time}`);
            }

            await updateTrace(drone);

            const trace = flightTraces.get(drone.id) || [];
            //log.debug(`[poller] Drone ${drone.id} trace length: ${trace.length}`);

            if (trace.length > 5) {
                //log.debug(`[poller] Drone ${drone.id} trace sample: ${JSON.stringify(trace.slice(0, 5))}`);
            }

            const fullDroneData = {
                ...drone,
                trace,
                state: drone.state || 'live',
            };

            fullDrones.push(fullDroneData);

            //log.info(`[poller] Saving flight history for drone ${drone.id} with ${fullDroneData.trace.length} trace points`);
            await saveFlightToHistory(fullDroneData, detectedIds);
            //log.info(`[poller] Saved flight history for drone ${drone.id}`);
        }

        const filteredFullDrones = fullDrones.filter(flight => flight.state !== 'local');
        //log.info(`[poller] Broadcasting ${filteredFullDrones.length} drones after filtering local`);

        broadcast(filteredFullDrones, clients, true);

        //log.info('[poller] Broadcast to clients complete');
    } catch (err) {
        log.error(`[poller] Error during polling: ${err.stack || err.message || err}`);
    } finally {
        isPolling = false;
        log.info('[poller] Poll cycle finished');
    }
}

module.exports = poller;
