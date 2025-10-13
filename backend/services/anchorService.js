const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const log = require('../utils/logger');
const { config } = require('../config');
const { sendAnchorProof } = require('./blockchainService'); // Assurez-vous que ce fichier existe et exporte la fonction d'envoi

// Répertoires configurables
const rawAnchoredDir = config.backend.anchoredDir || 'anchored';
const ANCHORED_DIR = path.isAbsolute(rawAnchoredDir)
  ? rawAnchoredDir
  : path.resolve(__dirname, '..', rawAnchoredDir);

// Fichiers de suivi
const ANCHOR_FILE = path.join(__dirname, '..', config.backend.anchorFile || 'anchored.json');
const PENDING_FILE = path.join(__dirname, '..', config.backend.pendingFile || 'pendingAnchors.json');

// Lit la liste des ancrages sauvegardés
async function getAnchoredList() {
  try {
    if (!fs.existsSync(ANCHOR_FILE)) {
      log.debug(`Fichier ${ANCHOR_FILE} inexistant → liste vide`);
      return [];
    }
    const content = await fsPromises.readFile(ANCHOR_FILE, 'utf-8');
    try {
      const anchoredList = JSON.parse(content);
      log.info(`Liste ancrages chargée : ${anchoredList.length} élément(s)`);
      return anchoredList;
    } catch (parseErr) {
      log.error(`Fichier ${ANCHOR_FILE} corrompu : ${parseErr.message}`);
      return [];
    }
  } catch (error) {
    log.error(`Lecture ${ANCHOR_FILE} échouée : ${error.message}`);
    throw new Error('Impossible de lire la liste des ancrages.');
  }
}

// Sauvegarde la liste des ancrages
async function saveAnchoredList(anchoredList) {
  try {
    await fsPromises.writeFile(ANCHOR_FILE, JSON.stringify(anchoredList, null, 2));
    log.info(`${ANCHOR_FILE} mis à jour (${anchoredList.length} entrée(s))`);
  } catch (error) {
    log.error(`Sauvegarde ${ANCHOR_FILE} échouée : ${error.message}`);
    throw new Error('Impossible de sauvegarder la liste des ancrages.');
  }
}

// Lit la liste des dossiers en attente d’envoi à la blockchain
async function getPendingList() {
  try {
    if (!fs.existsSync(PENDING_FILE)) {
      log.debug(`Fichier ${PENDING_FILE} inexistant → liste vide`);
      return [];
    }
    const content = await fsPromises.readFile(PENDING_FILE, 'utf-8');
    try {
      const pendingList = JSON.parse(content);
      log.info(`Liste pending chargée : ${pendingList.length} élément(s)`);
      return pendingList;
    } catch (parseErr) {
      log.error(`Fichier ${PENDING_FILE} corrompu : ${parseErr.message}`);
      return [];
    }
  } catch (error) {
    log.error(`Lecture ${PENDING_FILE} échouée : ${error.message}`);
    throw new Error('Impossible de lire la liste des envois différés.');
  }
}

// Sauvegarde la liste des dossiers en attente
async function savePendingList(pendingList) {
  try {
    await fsPromises.writeFile(PENDING_FILE, JSON.stringify(pendingList, null, 2));
    log.info(`${PENDING_FILE} mis à jour (${pendingList.length} entrée(s))`);
  } catch (error) {
    log.error(`Sauvegarde ${PENDING_FILE} échouée : ${error.message}`);
    throw new Error('Impossible de sauvegarder la liste des envois différés.');
  }
}

// Ajoute un dossier dans la file d’attente si absent
async function addPendingFolder(folderName) {
  const pendingList = await getPendingList();
  if (!pendingList.includes(folderName)) {
    pendingList.push(folderName);
    await savePendingList(pendingList);
    log.info(`Ajout dossier en attente : ${folderName}`);
  }
}

// Retire un dossier de la file d’attente
async function removePendingFolder(folderName) {
  let pendingList = await getPendingList();
  pendingList = pendingList.filter(item => item !== folderName);
  await savePendingList(pendingList);
  log.info(`Suppression dossier de la file d’attente : ${folderName}`);
}

// Sauvegarde locale du dossier d’ancrage avec proof.zip et ancrage.json
async function saveAnchorWithProof(anchorData, proofZip) {
  try {
    if (!proofZip) throw new Error('Fichier preuve.zip manquant.');

    const dateDir = new Date().toISOString().replace(/[:.]/g, '-');
    const safeId = anchorData.id ? anchorData.id.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown';
    const folderName = `anchor_${safeId}_${dateDir}`;
    const destinationDir = path.join(ANCHORED_DIR, folderName);

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

    await fsPromises.writeFile(
      path.join(destinationDir, 'ancrage.json'),
      JSON.stringify(orderedAnchorData, null, 2)
    );
    log.debug(`ancrage.json sauvegardé dans ${destinationDir}`);

    await fsPromises.writeFile(path.join(destinationDir, 'preuve.zip'), proofZip);
    log.debug(`preuve.zip sauvegardé dans ${destinationDir}`);

    return folderName;
  } catch (error) {
    log.error(`Échec saveAnchorWithProof : ${error.message}`);
    throw error;
  }
}

// Gestionnaire POST /anchor avec tentative d'envoi blockchain et file d’attente en cas d’échec
async function handlePostAnchor(req, res) {
  log.debug(`→ POST /anchor depuis ${req.ip}`);

  try {
    if (!req.body.anchorData) {
      log.warn('anchorData manquant');
      return res.status(400).json({ error: 'anchorData requis' });
    }

    let anchorData;
    try {
      anchorData = JSON.parse(req.body.anchorData);
    } catch {
      log.warn('anchorData JSON mal formé');
      return res.status(400).json({ error: 'anchorData invalide (JSON mal formé)' });
    }

    if (!(anchorData.id || anchorData._id)) {
      log.warn('Identifiant id ou _id manquant');
      return res.status(400).json({ error: 'id ou _id requis' });
    }
    if (!anchorData.time) {
      log.warn('Champ time manquant');
      return res.status(400).json({ error: 'time requis' });
    }
    if (!anchorData.type) {
      log.warn('Champ type manquant');
      return res.status(400).json({ error: 'type requis' });
    }

    if (!req.file) {
      log.warn('Fichier preuve.zip manquant');
      return res.status(400).json({ error: 'Fichier preuve.zip manquant' });
    }

    // Sauvegarde locale des fichiers ancrage et preuve
    const folderName = await saveAnchorWithProof(anchorData, req.file.buffer);

    // Tentative d'envoi à la blockchain
    const jsonBuffer = Buffer.from(JSON.stringify(anchorData, null, 2), 'utf-8');

    try {
      log.debug(`Tentative d’envoi blockchain pour dossier ${folderName}`);
      await sendAnchorProof(req.file.buffer, jsonBuffer);
      log.info(`Envoi blockchain réussi pour ${folderName}`);
    } catch (sendErr) {
      log.warn(`Échec envoi blockchain pour ${folderName} : ${sendErr.message}`);
      await addPendingFolder(folderName);
    }

    return res.json({ ok: true, folder: folderName });
  } catch (error) {
    log.error(`/anchor - ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAnchoredList,
  saveAnchoredList,
  getPendingList,
  savePendingList,
  addPendingFolder,
  removePendingFolder,
  saveAnchorWithProof,
  handlePostAnchor,
  ANCHORED_DIR,
  PENDING_FILE,
};
