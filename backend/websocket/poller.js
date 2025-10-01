const { log } = require('../utils/logger');
const broadcast = require('./broadcast');
const { fetchDroneData } = require('../graphqlClient');
const { saveFlightToHistory, notifyUpdate } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');
const { clients } = require('./connections');
const updateTrace = require('./updateTrace');
const { config } = require('../config');

let isPolling = false;

/**
 * Fonction utilitaire pour relancer une requête plusieurs fois en cas d'erreur.
 */
async function fetchWithRetry(fn, retries = 5, delayMs = 1000) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (err) {
            attempt++;
            if (attempt >= retries) throw err;
            log(`[poller] Retry ${attempt} after error: ${err.message}, waiting ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

/**
 * Fonction principale qui fait le polling régulier des données drone,
 * met à jour les traces enrichies et sauvegarde dans l'historique.
 */
async function poller() {
    if (isPolling) {
        log('[poller] Already polling, skipping');
        return;
    }
    isPolling = true;

    try {
        let drones;
        if (config.backend.useTestSim) {
            const simulation = require('../simulation');
            drones = await simulation.getCurrentSimulationData();
            log(`[poller] Retrieved data from simulation, count: ${drones.length}`);
        } else {
            const data = await fetchWithRetry(fetchDroneData, 5, 1000);
            drones = data?.data?.drone ? (Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone]) : [];
            log(`[poller] Retrieved data from API, count: ${drones.length}`);
        }

        if (!drones || drones.length === 0) {
            log('[poller] No drones detected');
            isPolling = false;
            return;
        }

        const fullDrones = [];

        for (const drone of drones) {
            if (drone.data && Array.isArray(drone.data.drone) && drone.data.drone.length === 0) {
                log('[poller] Empty drone data detected, ignoring');
                continue;
            }

            if (!drone.id) {
                log('[poller] Drone without ID skipped');
                continue;
            }

            await updateTrace(drone);

            const trace = flightTraces.get(drone.id) || [];
            log(`[poller] Drone ${drone.id} trace length after updateTrace: ${trace.length}`);
            log(`[poller] Drone ${drone.id} trace sample after updateTrace: ${JSON.stringify(trace.slice(0, 5))}`);

            const fullDroneData = {
                ...drone,
                trace,
                type: drone.type || 'live',
            };

            fullDrones.push(fullDroneData);

            log(`[poller] Drone ${drone.id} fullDroneData trace length before save: ${fullDroneData.trace.length}`);
            log(`[poller] Drone ${drone.id} fullDroneData trace sample before save: ${JSON.stringify(fullDroneData.trace.slice(0, 5))}`);

            log(`[poller] Saving flight to history for drone ${drone.id}`);
            const filename = await saveFlightToHistory(fullDroneData);
            if (filename) {
                log(`[poller] Saved flight to file: ${filename}`);
            } else {
                log(`[poller] Failed to save flight for drone ${drone.id}`);
            }
            notifyUpdate(filename);
        }

        broadcast(fullDrones, clients);  // <-- Envoi des données enrichies avec trace
        log('[poller] Broadcast to clients complete');
    } catch (err) {
        log(`[poller] Error: ${err.message}`);
    } finally {
        isPolling = false;
    }
}


module.exports = poller;
