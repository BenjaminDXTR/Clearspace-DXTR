const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const log = require('../utils/logger');
const { config } = require('../config');

const rawAnchoredDir = config.backend.anchoredDir || 'anchored';
const ANCHORED_DIR = path.isAbsolute(rawAnchoredDir)
  ? rawAnchoredDir
  : path.resolve(__dirname, '..', rawAnchoredDir);

const ANCHOR_FILE = path.join(__dirname, '..', config.backend.anchorFile || 'anchored.json');

/**
 * Lit la liste complète des vols ancrés depuis le fichier JSON.
 */
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

/**
 * Écrit la liste complète des vols ancrés dans le fichier JSON.
 */
async function saveAnchoredList(anchoredList) {
  try {
    await fsPromises.writeFile(ANCHOR_FILE, JSON.stringify(anchoredList, null, 2));
    log.info(`${ANCHOR_FILE} mis à jour (${anchoredList.length} entrée(s))`);
  } catch (error) {
    log.error(`Sauvegarde ${ANCHOR_FILE} échouée : ${error.message}`);
    throw new Error('Impossible de sauvegarder la liste des ancrages.');
  }
}

/**
 * Sauvegarde un nouveau vol ancré dans un dossier + met à jour anchored.json.
 */
async function saveAnchorWithProof(anchorData, proofZip) {
  try {
    if (!proofZip) throw new Error('Fichier preuve.zip manquant.');

    const dateDir = new Date().toISOString().replace(/[:.]/g, '-');
    const destinationDir = path.join(ANCHORED_DIR, dateDir);
    await fsPromises.mkdir(destinationDir, { recursive: true });

    await fsPromises.writeFile(
      path.join(destinationDir, 'ancrage.json'),
      JSON.stringify(anchorData, null, 2)
    );
    log.debug(`ancrage.json sauvegardé dans ${destinationDir}`);

    await fsPromises.writeFile(
      path.join(destinationDir, 'preuve.zip'),
      proofZip
    );
    log.debug(`preuve.zip sauvegardé dans ${destinationDir}`);

    const anchoredList = await getAnchoredList();
    const exists = anchoredList.some(
      entry => entry.id === anchorData.id && entry.created_time === anchorData.created_time
    );

    if (!exists) {
      anchoredList.push({
        ...anchorData,
        anchored_at: new Date().toISOString()
      });
      await saveAnchoredList(anchoredList);
      log.info('Nouveau vol ajouté à la liste globale des ancrages');
    } else {
      log.warn('Vol déjà présent dans la liste globale des ancrages');
    }

    return destinationDir;
  } catch (error) {
    log.error(`Échec saveAnchorWithProof : ${error.message}`);
    throw error;
  }
}

/* ======================
   HANDLERS EXPRESS
====================== */

/**
 * GET /anchored → retourne la liste des vols ancrés.
 */
async function handleGetAnchored(req, res) {
  log.debug(`→ GET /anchored depuis ${req.ip}`);
  try {
    const list = await getAnchoredList();
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /anchor → ancrer un vol avec preuve ZIP.
 */
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

    if (!anchorData.id || !anchorData.created_time) {
      log.warn('id ou created_time manquant');
      return res.status(400).json({ error: 'id et created_time requis' });
    }

    if (!req.file) {
      log.warn('Fichier preuve.zip manquant');
      return res.status(400).json({ error: 'Fichier preuve.zip manquant' });
    }

    const savedFolder = await saveAnchorWithProof(anchorData, req.file.buffer);
    return res.json({ ok: true, folder: savedFolder });
  } catch (error) {
    log.error(`/anchor - ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getAnchoredList,
  saveAnchoredList,
  saveAnchorWithProof,
  handleGetAnchored,
  handlePostAnchor,
};
