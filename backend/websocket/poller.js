const log = require('../utils/logger'); // nouveau logger avec log.debug/info/warn/error
const broadcast = require('./broadcast');
const { fetchDroneData } = require('../graphqlClient');
const { saveFlightToHistory, notifyUpdate } = require('../flightsManager');
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
            drones = await simulation.getCurrentSimulationData();
            log.debug(`[poller] Retrieved data from simulation, count: ${drones.length}`);
        } else {
            const data = await fetchWithRetry(fetchDroneData, 5, 1000);
            drones = data?.data?.drone ? (Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone]) : [];
            log.debug(`[poller] Retrieved data from API, count: ${drones.length}`);
        }

        if (!drones || drones.length === 0) {
            log.info('[poller] No drones detected');
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

            await updateTrace(drone);

            const trace = flightTraces.get(drone.id) || [];
            log.debug(`[poller] Drone ${drone.id} trace length: ${trace.length}`);
            log.debug(`[poller] Drone ${drone.id} trace sample: ${JSON.stringify(trace.slice(0, 5))}`);

            const fullDroneData = {
                ...drone,
                trace,
                type: drone.type || 'live',
            };

            fullDrones.push(fullDroneData);

            log.debug(`[poller] Drone ${drone.id} fullDroneData trace length before save: ${fullDroneData.trace.length}`);
            log.debug(`[poller] Drone ${drone.id} fullDroneData trace sample before save: ${JSON.stringify(fullDroneData.trace.slice(0, 5))}`);

            log.info(`[poller] Saving flight to history for drone ${drone.id}`);
            const filename = await saveFlightToHistory(fullDroneData);
            if (filename) {
                log.info(`[poller] Saved flight to file: ${filename}`);
            } else {
                log.error(`[poller] Failed to save flight for drone ${drone.id}`);
            }
            notifyUpdate(filename);
        }

        broadcast(fullDrones, clients);
        log.info('[poller] Broadcast to clients complete');
    } catch (err) {
        log.error(`[poller] Error during polling: ${err.message}`);
    } finally {
        isPolling = false;
    }
}

module.exports = poller;
