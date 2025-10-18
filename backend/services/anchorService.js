const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const log = require('../utils/logger');
const { config } = require('../config');
const { sendAnchorProof } = require('./blockchainService');
const { loadHistoryToCache, flushCacheToDisk, findOrCreateHistoryFile, notifyUpdate } = require('../flightsManager');

const ANCHOR_DATA_DIR = path.resolve(__dirname, '..', 'anchorData');
const PENDING_DIR = path.join(ANCHOR_DATA_DIR, 'pending');
const ANCHORED_DIR = path.join(ANCHOR_DATA_DIR, 'anchored');

const ANCHOR_FILE = path.join(ANCHORED_DIR, 'anchored.json');

function formatDateTimeForName(date = new Date()) {
  const pad = (n) => n.toString().padStart(2, '0');
  return (
    date.getFullYear() + '_' +
    pad(date.getMonth() + 1) + '_' +
    pad(date.getDate()) + '-' +
    pad(date.getHours()) + '_' +
    pad(date.getMinutes()) + '_' +
    pad(date.getSeconds())
  );
}

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

async function saveAnchoredList(anchoredList) {
  try {
    await fsPromises.writeFile(ANCHOR_FILE, JSON.stringify(anchoredList, null, 2));
    log.info(`Historique ancrages mis à jour (${anchoredList.length} entrées)`);
  } catch (error) {
    log.error(`Erreur sauvegarde ${ANCHOR_FILE} : ${error.message}`);
    throw error;
  }
}

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

async function addPendingFolder(folderName) {
  log.info(`Dossier ajouté à en attente (physique) : ${folderName}`);
}

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

async function updateAnchorState(id, created_time, newState) {
  try {
    const filename = await findOrCreateHistoryFile(created_time);
    const historyData = await loadHistoryToCache(filename);

    log.debug(`[updateAnchorState] Recherche vol id=${id} created_time=${created_time} dans fichier ${filename}`);
    log.debug(`[updateAnchorState] Liste actuelle des vols (${historyData.length} entrées) : ${historyData.map(f => `id=${f.id}, created_time=${f.created_time}`).join("; ")}`);

    const idx = historyData.findIndex(f => f.id === id && f.created_time === created_time);
    if (idx === -1) {
      log.warn(`[updateAnchorState] Vol non trouvé dans l'historique pour id=${id}, created_time=${created_time}`);
      return;
    }

    log.info(`[updateAnchorState] Mise à jour anchorState de vol id=${id} en "${newState}"`);
    historyData[idx].anchorState = newState;
    await flushCacheToDisk(filename);
    notifyUpdate(filename);
    log.info(`[updateAnchorState] Sauvegarde et notification terminées pour vol id=${id}`);
  } catch (err) {
    log.error(`[updateAnchorState] Erreur mise à jour anchorState vol ${id} : ${err.message}`);
    throw err;
  }
}

async function saveAnchorWithProof(anchorData, proofZip) {
  try {
    if (!proofZip) throw new Error('Fichier preuve.zip manquant.');

    const now = new Date();
    const dateDir = formatDateTimeForName(now);
    const safeId = anchorData.extra && anchorData.extra.id
      ? String(anchorData.extra.id).replace(/[^a-zA-Z0-9_-]/g, '_')
      : 'unknown';

    const zipName = anchorData.zipName || `preuves-${safeId}-${dateDir}`;

    const folderName = `anchor_${safeId}_${dateDir}`;
    const destinationDir = path.join(PENDING_DIR, folderName);

    await fsPromises.mkdir(destinationDir, { recursive: true });

    const jsonFileName = `data-${safeId}-${dateDir}.json`;
    const zipFileName = `${zipName}.zip`;

    await fsPromises.writeFile(
      path.join(destinationDir, jsonFileName),
      JSON.stringify(anchorData, null, 2)
    );
    log.debug(`${jsonFileName} sauvegardé dans ${destinationDir}`);

    await fsPromises.writeFile(path.join(destinationDir, zipFileName), proofZip);
    log.debug(`${zipFileName} sauvegardé dans ${destinationDir}`);

    return folderName;
  } catch (error) {
    log.error(`Erreur saveAnchorWithProof : ${error.message}`);
    throw error;
  }
}

async function moveFolderToAnchored(folderName) {
  const src = path.join(PENDING_DIR, folderName);
  const dest = path.join(ANCHORED_DIR, folderName);

  await fsPromises.mkdir(ANCHORED_DIR, { recursive: true });
  await fsPromises.rename(src, dest);

  const anchoredList = await getAnchoredList();
  anchoredList.push({ folderName, date: new Date().toISOString() });
  await saveAnchoredList(anchoredList);
}

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

    if (!(anchorData.extra && anchorData.extra.id)) return res.status(400).json({ error: 'extra.id requis' });
    if (!anchorData.time) return res.status(400).json({ error: 'time requis' });
    if (!anchorData.type) return res.status(400).json({ error: 'type requis' });
    if (!req.file) return res.status(400).json({ error: 'Fichier preuve.zip manquant' });

    if (!anchorData.extra.anchored_requested_at) {
      anchorData.extra.anchored_requested_at = new Date().toISOString();
    }

    // Enregistrer configuration initiale dans pending
    const folderName = await saveAnchorWithProof(anchorData, req.file.buffer);

    // Préparer le buffer JSON pour envoi blockchain
    const jsonBuffer = Buffer.from(JSON.stringify(anchorData, null, 2), 'utf-8');

    try {
      await sendAnchorProof(req.file.buffer, jsonBuffer);

      // Si succès, déplacer vers anchored
      await moveFolderToAnchored(folderName);
      await updateAnchorState(anchorData.extra.id, anchorData.extra.created_time, 'anchored');

      return res.json({ ok: true, message: 'Vol dans la blockchain', folder: folderName });
    } catch (err) {
      // Toujours marquer l'ancrage en pending et stocker même si erreur
      await addPendingFolder(folderName);
      await updateAnchorState(anchorData.extra.id, anchorData.extra.created_time, 'pending');

      if (err.response && err.response.status === 403) {
        return res.status(403).json({
          ok: false,
          message: 'Accès refusé par la blockchain : ressource interdite (403). ' +
            "L'ancrage est mis en attente et sera envoyé automatiquement une fois le problème résolu.",
          error: err.message,
          folder: folderName,
        });
      }

      return res.status(202).json({
        ok: false,
        message: 'Enregistrement local, échec envoi blockchain',
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
