const path = require('path');
const fsPromises = require('fs').promises;
const log = require('../utils/logger');
const anchorService = require('./anchorService');
const { sendAnchorProof } = require('./blockchainService');
const { notifyUpdate } = require('../flightsManager');

async function retryPendingAnchors() {
  try {
    const pendingDir = anchorService.PENDING_DIR;
    const dirents = await fsPromises.readdir(pendingDir, { withFileTypes: true });
    const pendingList = dirents.filter(d => d.isDirectory()).map(d => d.name);

    log.info(`RetryPending : ${pendingList.length} dossier(s) en attente trouvés`);

    for (const folderName of pendingList) {
      try {
        // Extraction des infos à partir du nom de dossier
        const match = folderName.match(/^anchor_(.+)_(\d{4}_\d{2}_\d{2}-\d{2}_\d{2}_\d{2})$/);
        if (!match) {
          log.warn(`Dossier non conforme pour retry : ${folderName}`);
          continue;
        }
        const folderId = match[1];
        const datePart = match[2];

        // Construire les chemins des fichiers attendus
        const proofZipPath = path.join(pendingDir, folderName, `preuves-${folderId}-${datePart}.zip`);
        const ancrageJsonPath = path.join(pendingDir, folderName, `data-${folderId}-${datePart}.json`);

        // Lecture des fichiers
        const zipBuffer = await fsPromises.readFile(proofZipPath);
        const jsonBuffer = await fsPromises.readFile(ancrageJsonPath);

        // Envoi blockchain
        await sendAnchorProof(zipBuffer, jsonBuffer);
        log.info(`Envoi blockchain réussi pour dossier ${folderName}`);

        // Déplacer dossier de pending à anchored
        await anchorService.moveFolderToAnchored(folderName);

        // Extraire données d'ancrage pour mise à jour état
        const anchorData = JSON.parse(jsonBuffer.toString('utf-8'));
        const extra = anchorData.extra || {};
        const id = extra.id;
        const created_time = extra.created_time;

        // Mise à jour de l'état anchor dans historique
        await anchorService.updateAnchorState(id, created_time, 'anchored');

        // Notification websocket de mise à jour
        const filename = await anchorService.findOrCreateHistoryFile(created_time);
        notifyUpdate(filename);

      } catch (err) {
        log.warn(`Échec envoi dossier ${folderName} : ${err.message}`);
        // Dossier reste en pending pour un prochain retry
      }
    }
  } catch (err) {
    log.error(`Erreur dans retryPendingAnchors : ${err.message}`);
  }
}

module.exports = { retryPendingAnchors };
