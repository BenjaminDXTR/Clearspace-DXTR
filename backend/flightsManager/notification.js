const broadcast = require('../websocket/broadcast');
const clients = require('../websocket/clients');
const log = require('../utils/logger');

function notifyUpdate(filename) {
  if (!filename) {
    log.warn('[notifyUpdate] No filename provided, skipping broadcast.');
    return;
  }
  if (!clients || !(clients instanceof Set)) {
    log.error('[notifyUpdate] Clients set undefined or invalid, skipping broadcast.');
    return;
  }

  log.info(`[notifyUpdate] Broadcasting refresh notification for file: ${filename}`);

  try {
    broadcast({ type: 'refresh', data: { filename } }, clients);
  } catch (error) {
    log.error(`[notifyUpdate] Error broadcasting notification: ${error.message}`);
  }
}

module.exports = { notifyUpdate };
