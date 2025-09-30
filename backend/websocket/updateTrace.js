const { log } = require('../utils/logger');
const { saveFlight, notifyUpdate } = require('../flightsManager');
const { flightTraces } = require('../flightsManager/state');  // Import unifié
const { config } = require('../config');

/**
 * Met à jour la trace d'un drone en ajoutant des points enrichis du temps relatif.
 * @param {Object} update Objet contenant id, latitude, longitude, created_time
 */
async function updateTrace(update) {
    const { id, latitude, longitude, created_time } = update;

    if (!id) {
        log('[updateTrace] Missing drone id, ignoring update');
        return;
    }

    if (!flightTraces.has(id)) {
        flightTraces.set(id, []);
        log(`[updateTrace] Created new trace array for drone ${id}`);
    }

    const trace = flightTraces.get(id);
    log(`[updateTrace] Current trace length for drone ${id}: ${trace.length}`);

    if (typeof latitude === 'number' && typeof longitude === 'number' && created_time) {
        try {
            // Calcul du temps relatif en ms entre le created_time du vol et maintenant
            const createdTimestamp = new Date(created_time).getTime();
            const nowTimestamp = Date.now();
            const relativeTime = nowTimestamp - createdTimestamp;

            // Ajouter seulement si nouvelle coordonnée différente de la dernière
            if (
                trace.length === 0 ||
                trace[trace.length - 1][0] !== latitude ||
                trace[trace.length - 1][1] !== longitude
            ) {
                trace.push([latitude, longitude, relativeTime]);
                log(`[updateTrace] Added point to drone ${id}, total points in trace: ${trace.length}`);
            } else {
                log(`[updateTrace] Duplicate point, not added for drone ${id}`);
            }
        } catch (e) {
            log(`[updateTrace] Error calculating relative time for drone ${id}: ${e.message}`);
        }
    } else {
        log(`[updateTrace] Invalid coordinates or missing created_time for drone ${id}`);
    }

    log(`[updateTrace] Trace snapshot for drone ${id}: ${JSON.stringify(trace.slice(-5))}`);

    // En mode simulation, sauvegarde immédiate pour vérification
    if (config.backend.useTest) {
        try {
            const fullFlight = { ...update, trace: trace.slice(), type: 'live' };
            const filename = await saveFlight(fullFlight);
            notifyUpdate(filename);
            log(`[updateTrace] Saved flight during simulation for drone ${id} in file ${filename}`);
        } catch (error) {
            log(`[updateTrace] Error saving drone ${id} in simulation: ${error.message}`);
        }
    }
}

module.exports = updateTrace;
