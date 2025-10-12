const { stopPolling, closeAllConnections, getWss } = require('../websocket/websocket');
const { flushAllCache, archiveLiveFlightsOnShutdown } = require('../flightsManager');
const { server, connections } = require('../server'); // Assurez-vous que server et connections sont bien exportés
const log = require('../utils/logger');

let serverInstance = null;
let flushIntervalsClear = null;

/**
 * Enregistre l'instance serveur HTTP et la fonction de nettoyage des intervalles.
 *
 * @param {http.Server} server Instance du serveur HTTP
 * @param {function} clearIntervalsFn Fonction pour nettoyer les intervalles périodiques
 */
function setServerAndIntervals(server, clearIntervalsFn) {
    serverInstance = server;
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

    // Timeout global forcé à 15 secondes
    const forceTimeout = setTimeout(() => {
        log.warn('Timeout global dépassé, forçage sortie process');
        process.exit(1);
    }, 15000);

    try {
        // 1. Arrêt du polling et fermeture WS (stopPolling ferme WebSocket et met wss null)
        await stopPolling();
        log.info('Polling arrêté, WebSocket fermé.');

        // 2. Nettoyage des intervalles périodiques (ex flush périodique)
        if (flushIntervalsClear) {
            flushIntervalsClear();
            log.info('Intervals arrêtés.');
        }

        // 3. Archivage des vols en mémoire
        await archiveLiveFlightsOnShutdown();
        log.info('Archivage des vols en mémoire terminé.');

        // 4. Flush final du cache vers disque
        await flushAllCache();
        log.info('Flush final du cache effectué.');

        // 5. Vérification et fermeture des connexions WebSocket restantes (si wss pas encore null)
        const wss = getWss();
        if (!wss) {
            log.info('WebSocket déjà fermé.');
        } else {
            log.warn('WebSocket actif encore au shutdown, fermeture supplémentaire.');
            await closeAllConnections();
            log.info('Connexions WebSocket fermées.');
        }

        // 6. Fermeture forcée des connexions TCP HTTP restantes
        if (connections && connections.size > 0) {
            log.info(`Fermeture forcée de ${connections.size} connexions HTTP ouvertes`);
            let idx = 0;
            connections.forEach(conn => {
                idx++;
                try {
                    log.info(
                        `Fermeture connexion TCP #${idx} - LocalPort: ${conn.localPort}, RemoteAddress: ${conn.remoteAddress}, RemotePort: ${conn.remotePort}`
                    );
                    conn.setTimeout(1); // Stop keep-alive pour accélérer fermeture
                    conn.destroy(); // Fermer la connexion TCP immédiatement
                    log.info(`Connexion TCP #${idx} fermée avec succès`);
                } catch (err) {
                    log.error(`Erreur fermeture connexion TCP #${idx} : ${err.message}`);
                }
            });
        } else {
            log.info('Aucune connexion HTTP ouverte à fermer');
        }

        // 7. Fermeture propre du serveur HTTP avec timeout interne à 3 secondes pour éviter blocage
        if (!serverInstance) {
            log.error('Serveur HTTP non défini au shutdown.');
            clearTimeout(forceTimeout);
            process.exit(1);
        }
        log.info(`Connexions TCP restantes sur serveur avant fermeture: ${serverInstance._connections || 0}`);

        const serverClosePromise = new Promise((resolve, reject) => {
            serverInstance.close(err => {
                if (err) reject(err);
                else resolve();
            });
        });

        const timeoutClose = new Promise(resolve => {
            setTimeout(() => {
                log.warn('Timeout interne de fermeture serveur dépassé (3s), forçage fermeture');
                resolve();
            }, 3000); // Timeout interne réduit à 3 secondes
        });

        await Promise.race([serverClosePromise, timeoutClose]);
        log.info('Fermeture serveur HTTP terminée ou timeout interne dépassé.');

        // 8. Nettoyer timeout global et forcer exit
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
