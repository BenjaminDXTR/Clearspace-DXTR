const broadcast = require('../websocket/broadcast');
const clients = require('../websocket/clients');
const log = require('../utils/logger');

function notifyUpdate(filename) {
  //log.info(`[notifyUpdate] notifyUpdate called for file: ${filename || 'undefined or empty'}`);

  if (!filename) {
    log.warn('[notifyUpdate] No filename provided, skipping broadcast.');
    return;
  }
  if (!clients || !(clients instanceof Set)) {
    log.error('[notifyUpdate] Clients set undefined or invalid, skipping broadcast.');
    return;
  }

  //log.info(`[notifyUpdate] Broadcasting refresh notification for file: ${filename}`);

  try {
    broadcast({ type: 'refresh', data: { filename } }, clients);
  } catch (error) {
    log.error(`[notifyUpdate] Error during broadcast of refresh notification for file ${filename}: ${error.message}`);
  }
}

module.exports = { notifyUpdate };
