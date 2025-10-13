const path = require('path');
const fsPromises = require('fs').promises;
const log = require('../utils/logger');
const anchorService = require('./anchorService');
const { sendAnchorProof } = require('./blockchainSender'); // À créer séparément

async function retryPendingAnchors() {
    try {
        const pendingList = await anchorService.getPendingList();

        for (const folderName of pendingList) {
            try {
                log.info(`Tentative d’envoi de la preuve blockchain pour dossier en attente : ${folderName}`);

                const proofZipPath = path.join(anchorService.ANCHORED_DIR, folderName, 'preuve.zip');
                const ancrageJsonPath = path.join(anchorService.ANCHORED_DIR, folderName, 'ancrage.json');

                const zipBuffer = await fsPromises.readFile(proofZipPath);
                const jsonBuffer = await fsPromises.readFile(ancrageJsonPath);

                await sendAnchorProof(zipBuffer, jsonBuffer);
                log.info(`Envoi réussi pour dossier ${folderName}`);

                await anchorService.removePendingFolder(folderName);

                // TODO: mettre à jour historique isAnchored ici si nécessaire

            } catch (err) {
                log.warn(`Échec envoi dossier ${folderName} : ${err.message}`);
                // Ne pas supprimer le dossier, on réessaiera plus tard
            }
        }
    } catch (err) {
        log.error(`Erreur lors du retry des envois différés : ${err.message}`);
    }
}

// Exports la fonction pour planification intervalle
module.exports = { retryPendingAnchors };
