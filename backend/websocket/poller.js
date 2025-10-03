const log = require('../utils/logger');
const broadcast = require('./broadcast');
const { fetchDroneData } = require('../graphqlClient');
const { saveFlightToHistory } = require('../flightsManager');
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

    log.info('[poller] Starting new poll cycle');

    try {
        let drones;
        if (config.backend.useTestSim) {
            const simulation = require('../simulation');
            drones = await simulation.getCurrentSimulationData();
            log.info(`[poller] Simulation data retrieved, drones count: ${drones.length}`);
        } else {
            const data = await fetchWithRetry(fetchDroneData, 5, 1000);
            drones = data?.data?.drone ? (Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone]) : [];
            log.info(`[poller] API data retrieved, drones count: ${drones.length}`);
        }

        if (!drones || drones.length === 0) {
            log.info('[poller] No drones detected, ending poll cycle');
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

            // Limiter les logs de snapshot à moins fréquent ou conditionnel (ex: trace > X)
            if (trace.length > 5) {
                log.debug(`[poller] Drone ${drone.id} trace sample: ${JSON.stringify(trace.slice(0, 5))}`);
            }

            const fullDroneData = {
                ...drone,
                trace,
                type: drone.type || 'live',
            };

            fullDrones.push(fullDroneData);

            log.info(`[poller] Saving flight to history for drone ${drone.id} with trace points: ${fullDroneData.trace.length}`);
            await saveFlightToHistory(fullDroneData);
        }

        // Filtrer les drones locaux pour ne pas les renvoyer en live
        const filteredFullDrones = fullDrones.filter(flight => flight.type !== 'local');
        log.info(`[poller] Broadcasting ${filteredFullDrones.length} drones after filtering local`);

        broadcast(filteredFullDrones, clients, true);

        log.info('[poller] Broadcast to clients complete');
    } catch (err) {
        log.error(`[poller] Error during polling: ${err.message}`);
    } finally {
        isPolling = false;
        log.info('[poller] Poll cycle finished');
    }
}

module.exports = poller;
