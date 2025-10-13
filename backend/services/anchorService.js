const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const log = require('../utils/logger');
const { config } = require('../config');
const { sendAnchorProof } = require('./blockchainService');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile, notifyUpdate } = require('../flightsManager');

// Répertoires physiques fixes
const ANCHOR_DATA_DIR = path.resolve(__dirname, '..', 'anchorData');
const PENDING_DIR = path.join(ANCHOR_DATA_DIR, 'pending');
const ANCHORED_DIR = path.join(ANCHOR_DATA_DIR, 'anchored');

const ANCHOR_FILE = path.join(ANCHORED_DIR, 'anchored.json');

// Lis les ancrages terminés (historique)
async function getAnchoredList() {
  try {
    if (!fs.existsSync(ANCHOR_FILE)) {
      log.debug(`Fichier ${ANCHOR_FILE} inexistant → liste vide`);
      return [];
    }
    const content = await fsPromises.readFile(ANCHOR_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    log.error(`Erreur lecture ${ANCHOR_FILE} : ${error.message}`);
    return [];
  }
}

// Sauvegarde l’historique des ancrages terminés
async function saveAnchoredList(anchoredList) {
  try {
    await fsPromises.writeFile(ANCHOR_FILE, JSON.stringify(anchoredList, null, 2));
    log.info(`Historique ancrages mis à jour (${anchoredList.length} entrées)`);
  } catch (error) {
    log.error(`Erreur sauvegarde ${ANCHOR_FILE} : ${error.message}`);
    throw error;
  }
}

// Liste des dossiers dans pending/
async function getPendingList() {
  try {
    if (!fs.existsSync(PENDING_DIR)) {
      log.debug(`Dossier ${PENDING_DIR} inexistant → liste vide`);
      return [];
    }
    const dirents = await fsPromises.readdir(PENDING_DIR, { withFileTypes: true });
    const pendingFolders = dirents.filter(d => d.isDirectory()).map(d => d.name);
    log.debug(`Chargée liste des dossiers pending : ${pendingFolders.length} éléments`);
    return pendingFolders;
  } catch (error) {
    log.error(`Erreur lecture dossier pending : ${error.message}`);
    return [];
  }
}

// Ajoute dossier physique pending (juste log ici)
async function addPendingFolder(folderName) {
  // Le dossier est déjà créé en saveAnchorWithProof, donc uniquement log
  log.info(`Dossier ajouté à en attente (physique) : ${folderName}`);
}

// Retire dossier pending (supprime physiquement)
async function removePendingFolder(folderName) {
  try {
    const folderPath = path.join(PENDING_DIR, folderName);
    if (fs.existsSync(folderPath)) {
      await fsPromises.rm(folderPath, { recursive: true, force: true });
      log.info(`Dossier supprimé de pending : ${folderName}`);
    } else {
      log.warn(`Tentative suppression dossier pending inexistant : ${folderName}`);
    }
  } catch (error) {
    log.error(`Erreur suppression dossier pending ${folderName} : ${error.message}`);
    throw error;
  }
}

// Permet de mettre à jour le champ anchorState dans l’historique d’un vol selon id + created_time
async function updateAnchorState(id, created_time, newState) {
  try {
    const filename = await findOrCreateHistoryFile(created_time);
    const historyData = await loadHistoryToCache(filename);

    const idx = historyData.findIndex(f => f.id === id && f.created_time === created_time);
    if (idx === -1) {
      log.warn(`[updateAnchorState] Vol non trouvé dans historique : id=${id}, created_time=${created_time}`);
      return;
    }

    historyData[idx].anchorState = newState;
    await flushCacheToDisk(filename);
    notifyUpdate(filename);
    log.info(`[updateAnchorState] anchorState mis à jour pour vol ${id} : ${newState}`);
  } catch (err) {
    log.error(`[updateAnchorState] Erreur mise à jour anchorState vol ${id} : ${err.message}`);
    throw err;
  }
}

// Sauvegarde locale initiale dans pending
async function saveAnchorWithProof(anchorData, proofZip) {
  try {
    if (!proofZip) throw new Error('Fichier preuve.zip manquant.');

    const dateDir = new Date().toISOString().replace(/[:.]/g, '-');
    const safeId = anchorData.id ? anchorData.id.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown';
    const folderName = `anchor_${safeId}_${dateDir}`;
    const destinationDir = path.join(PENDING_DIR, folderName);

    await fsPromises.mkdir(destinationDir, { recursive: true });

    const orderedAnchorData = {
      _id: anchorData._id,
      id: anchorData.id,
      type: anchorData.type,
      created_time: anchorData.created_time,
      time: anchorData.time,
      anchored_at: anchorData.anchored_at,
      positionCible: anchorData.positionCible,
      positionVehicule: anchorData.positionVehicule,
      idSite: anchorData.idSite,
      siteId: anchorData.siteId,
      modele: anchorData.modele,
      "xtr5 serial number": anchorData["xtr5 serial number"],
      comment: anchorData.comment,
      transactionHash: anchorData.transactionHash,
      ...anchorData.extra,
    };

    await fsPromises.writeFile(path.join(destinationDir, 'ancrage.json'), JSON.stringify(orderedAnchorData, null, 2));
    log.debug(`ancrage.json sauvegardé dans ${destinationDir}`);

    await fsPromises.writeFile(path.join(destinationDir, 'preuve.zip'), proofZip);
    log.debug(`preuve.zip sauvegardé dans ${destinationDir}`);

    return folderName;
  } catch (error) {
    log.error(`Erreur saveAnchorWithProof : ${error.message}`);
    throw error;
  }
}

// Déplace un dossier de pending vers anchored après succès
async function moveFolderToAnchored(folderName) {
  const src = path.join(PENDING_DIR, folderName);
  const dest = path.join(ANCHORED_DIR, folderName);

  await fsPromises.mkdir(ANCHORED_DIR, { recursive: true });
  await fsPromises.rename(src, dest);
  log.info(`Dossier déplacé de pending à anchored : ${folderName}`);

  // Mise à jour historique
  const anchoredList = await getAnchoredList();
  anchoredList.push({ folderName, date: new Date().toISOString() });
  await saveAnchoredList(anchoredList);
}

// Gestionnaire POST /anchor complet
async function handlePostAnchor(req, res) {
  log.debug(`→ POST /anchor depuis ${req.ip}`);

  try {
    if (!req.body.anchorData) return res.status(400).json({ error: 'anchorData requis' });

    let anchorData;
    try {
      anchorData = JSON.parse(req.body.anchorData);
    } catch {
      return res.status(400).json({ error: 'anchorData invalide (JSON mal formé)' });
    }

    if (!(anchorData.id || anchorData._id)) return res.status(400).json({ error: 'id ou _id requis' });
    if (!anchorData.time) return res.status(400).json({ error: 'time requis' });
    if (!anchorData.type) return res.status(400).json({ error: 'type requis' });
    if (!req.file) return res.status(400).json({ error: 'Fichier preuve.zip manquant' });

    // Enregistrer initialement dans pending
    const folderName = await saveAnchorWithProof(anchorData, req.file.buffer);

    // Essayer l’envoi immédiat blockchain
    const jsonBuffer = Buffer.from(JSON.stringify(anchorData, null, 2), 'utf-8');
    try {
      log.debug(`Envoi blockchain pour ${folderName}`);
      await sendAnchorProof(req.file.buffer, jsonBuffer);
      log.info(`Envoi blockchain succès pour ${folderName}`);

      // Déplacer en anchored après succès
      await moveFolderToAnchored(folderName);

      // Mettre à jour anchorState à "anchored"
      await updateAnchorState(anchorData.id, anchorData.created_time, 'anchored');

      return res.json({ ok: true, message: 'Vol ancré avec succès dans la blockchain', folder: folderName });
    } catch (err) {
      log.warn(`Échec envoi blockchain, dossier reste en pending : ${folderName} - ${err.message}`);

      // On ne crée pas de liste JSON, dossier physique existe déjà
      await addPendingFolder(folderName);

      // Mettre à jour anchorState à "pending"
      await updateAnchorState(anchorData.id, anchorData.created_time, 'pending');

      return res.status(202).json({
        ok: false,
        message: 'Vol enregistré localement, envoi blockchain différé en raison d’une erreur',
        error: err.message,
        folder: folderName,
      });
    }
  } catch (error) {
    log.error(`/anchor - ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAnchoredList,
  saveAnchoredList,
  getPendingList,
  addPendingFolder,
  removePendingFolder,
  saveAnchorWithProof,
  moveFolderToAnchored,
  handlePostAnchor,
  updateAnchorState,
  ANCHOR_DATA_DIR,
  PENDING_DIR,
  ANCHORED_DIR,
};
