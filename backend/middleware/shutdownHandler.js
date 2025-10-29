const { stopPolling, closeAllConnections, getWss } = require('../websocket/websocket');
const { flushAllCache, archiveLiveFlightsOnShutdown } = require('../flightsManager');
const log = require('../utils/logger');

let serverInstance = null;
let flushIntervalsClear = null;
let connections = null;

/**
 * Enregistre l'instance serveur HTTP, la liste des connexions, 
 * et la fonction de nettoyage des intervalles.
 *
 * @param {http.Server} server Instance du serveur HTTP
 * @param {Set} connectionsSet Ensemble des connexions TCP actives
 * @param {function} clearIntervalsFn Fonction pour nettoyer les intervalles périodiques
 */
function setServerAndIntervals(server, connectionsSet, clearIntervalsFn) {
    serverInstance = server;
    connections = connectionsSet;
    flushIntervalsClear = clearIntervalsFn;
}

/**
 * Effectue le shutdown complet du backend avec forçage rapide si nécessaire.
 *
 * Ordre des opérations :
 *   1. Arrêt du polling et fermeture WebSocket
 *   2. Nettoyage des intervalles périodiques
 *   3. Archivage vols en mémoire
 *   4. Flush final du cache
 *   5. Fermeture connexions WebSocket restantes (double sécurité)
 *   6. Fermeture forcée connexions TCP HTTP restantes
 *   7. Fermeture serveur HTTP avec timeout interne à 3s
 *   8. Forçage de sortie du process après timeout global 15s
 */
async function gracefulShutdown() {
    log.info('Début shutdown : arrêt polling, archivage, flush cache.');

    const forceTimeout = setTimeout(() => {
        log.warn('Timeout global dépassé, forçage sortie process');
        process.exit(1);
    }, 15000);

    try {
        await stopPolling();
        log.info('Polling arrêté, WebSocket fermé.');

        if (flushIntervalsClear) {
            flushIntervalsClear();
            log.info('Intervals arrêtés.');
        }

        await archiveLiveFlightsOnShutdown();
        log.info('Archivage des vols en mémoire terminé.');

        await flushAllCache();
        log.info('Flush final du cache effectué.');

        const wss = getWss();
        if (!wss) {
            log.info('WebSocket déjà fermé.');
        } else {
            log.warn('WebSocket actif encore au shutdown, fermeture supplémentaire.');
            await closeAllConnections();
            log.info('Connexions WebSocket fermées.');
        }

        if (connections && connections.size > 0) {
            log.info(`Fermeture forcée de ${connections.size} connexions HTTP ouvertes`);
            let idx = 0;
            connections.forEach((conn) => {
                idx++;
                try {
                    log.info(
                        `Fermeture connexion TCP #${idx} - LocalPort: ${conn.localPort}, RemoteAddress: ${conn.remoteAddress}, RemotePort: ${conn.remotePort}`
                    );
                    conn.setTimeout(1);
                    conn.destroy();
                    log.info(`Connexion TCP #${idx} fermée avec succès`);
                } catch (err) {
                    log.error(`Erreur fermeture connexion TCP #${idx} : ${err.message}`);
                }
            });
        } else {
            log.info('Aucune connexion HTTP ouverte à fermer');
        }

        if (!serverInstance) {
            log.error('Serveur HTTP non défini au shutdown.');
            clearTimeout(forceTimeout);
            process.exit(1);
        }

        log.info(`Connexions TCP restantes sur serveur avant fermeture: ${serverInstance._connections || 0}`);

        const serverClosePromise = new Promise((resolve, reject) => {
            serverInstance.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        const timeoutClose = new Promise((resolve) => {
            setTimeout(() => {
                log.warn('Timeout interne de fermeture serveur dépassé (3s), forçage fermeture');
                resolve();
            }, 3000);
        });

        await Promise.race([serverClosePromise, timeoutClose]);
        log.info('Fermeture serveur HTTP terminée ou timeout interne dépassé.');

        clearTimeout(forceTimeout);
        process.exit(0);
    } catch (err) {
        log.error(`Erreur durant shutdown : ${err.message}`);
        clearTimeout(forceTimeout);
        process.exit(1);
    }
}

module.exports = {
    gracefulShutdown,
    setServerAndIntervals,
};
