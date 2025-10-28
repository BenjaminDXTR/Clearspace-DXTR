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
        // Extraction infos dossier
        const match = folderName.match(/^anchor_(.+)_(\d{4}_\d{2}_\d{2}-\d{2}_\d{2}_\d{2})$/);
        if (!match) {
          log.warn(`Dossier non conforme pour retry : ${folderName}`);
          continue;
        }
        const folderId = match[1];
        const datePart = match[2];

        // Chemins fichiers attendus
        const proofZipPath = path.join(pendingDir, folderName, `preuves-${folderId}-${datePart}.zip`);
        const ancrageJsonPath = path.join(pendingDir, folderName, `data-${folderId}-${datePart}.json`);

        // Lecture du JSON et du ZIP
        const zipBuffer = await fsPromises.readFile(proofZipPath);
        const jsonBufferOld = await fsPromises.readFile(ancrageJsonPath);

        // On prépare le JSON pour tentative : anchored_at = maintenant
        let anchorData = JSON.parse(jsonBufferOld.toString('utf-8'));
        if (!anchorData.extra) anchorData.extra = {};
        anchorData.extra.anchored_at = new Date().toISOString();

        const jsonBuffer = Buffer.from(JSON.stringify(anchorData, null, 2), 'utf-8');
        
        try {
          // Tentative d'envoi en blockchain
          await sendAnchorProof(zipBuffer, jsonBuffer);
          log.info(`Envoi blockchain réussi pour dossier ${folderName}`);

          // Déplacer dossier de pending à anchored
          await anchorService.moveFolderToAnchored(folderName);

          // Mise à jour de l'état anchor dans historique
          const id = anchorData.extra.id;
          const created_time = anchorData.extra.created_time;
          await anchorService.updateAnchorState(id, created_time, 'anchored');

          // Notification websocket de mise à jour
          const filename = await anchorService.findOrCreateHistoryFile(created_time);
          notifyUpdate(filename);

        } catch (err) {
          // En échec, on remet anchored_at à null et sauvegarde en pending
          anchorData.extra.anchored_at = null;
          const failedJsonBuffer = Buffer.from(JSON.stringify(anchorData, null, 2), 'utf-8');
          await fsPromises.writeFile(ancrageJsonPath, failedJsonBuffer);

          log.warn(`Échec envoi dossier ${folderName} : ${err.message}`);
          // Dossier reste en pending pour un prochain retry
        }
      } catch (err) {
        log.warn(`Erreur de traitement dossier ${folderName} : ${err.message}`);
      }
    }
  } catch (err) {
    log.error(`Erreur dans retryPendingAnchors : ${err.message}`);
  }
}

module.exports = { retryPendingAnchors };
