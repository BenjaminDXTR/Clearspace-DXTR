const broadcast = require('../websocket/broadcast');
const { clients } = require('../websocket/connections');
const { log } = require('../utils/logger');

/**
 * Notification via websocket pour indiquer au frontend de rafraîchir
 * la liste et/ou le contenu du fichier historique spécifié.
 * @param {string} filename Nom du fichier JSON mis à jour.
 */
function notifyUpdate(filename) {
    if (!filename) {
        log('[notifyUpdate] No filename provided, skipping broadcast.');
        return;
    }
    log(`[notifyUpdate] Broadcasting refresh notification for file: ${filename}`);

    try {
        broadcast({ type: 'refresh', data: { filename } }, clients);
    } catch (error) {
        log(`[notifyUpdate] Error broadcasting notification: ${error.message}`);
    }
}

module.exports = { notifyUpdate };
