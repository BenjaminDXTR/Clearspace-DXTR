const path = require('path');
const fsPromises = require('fs').promises;
const log = require('../utils/logger');
const anchorService = require('./anchorService');
const { sendAnchorProof } = require('./blockchainService');

async function retryPendingAnchors() {
    try {
        // Liste des dossiers existants dans le dossier pending
        const pendingDir = anchorService.PENDING_DIR;
        const dirents = await fsPromises.readdir(pendingDir, { withFileTypes: true });
        const pendingList = dirents.filter(d => d.isDirectory()).map(d => d.name);

        log.info(`RetryPending : ${pendingList.length} dossier(s) en attente trouvés`);

        for (const folderName of pendingList) {
            try {
                log.info(`Tentative d’envoi blockchain pour dossier en attente : ${folderName}`);

                const proofZipPath = path.join(pendingDir, folderName, 'preuve.zip');
                const ancrageJsonPath = path.join(pendingDir, folderName, 'ancrage.json');

                const zipBuffer = await fsPromises.readFile(proofZipPath);
                const jsonBuffer = await fsPromises.readFile(ancrageJsonPath);

                await sendAnchorProof(zipBuffer, jsonBuffer);
                log.info(`Envoi blockchain réussi pour dossier ${folderName}`);

                // Déplacer le dossier dans anchored après succès
                await anchorService.moveFolderToAnchored(folderName);

            } catch (err) {
                log.warn(`Échec envoi dossier ${folderName} : ${err.message}`);
                // Dossier reste dans pending pour nouvelle tentative plus tard
            }
        }
    } catch (err) {
        log.error(`Erreur dans retryPendingAnchors : ${err.message}`);
    }
}

module.exports = { retryPendingAnchors };
