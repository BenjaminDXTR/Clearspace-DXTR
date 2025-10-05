const express = require('express');
const router = express.Router();
const multer = require('multer');

const log = require('../utils/logger');
const { config } = require('../config');
const anchorService = require('../services/anchorService');

const maxSizeMB = config.backend.maxUploadMb || 50;
const upload = multer({ limits: { fileSize: maxSizeMB * 1024 * 1024 } });

// GET /anchored : liste des vols ancrés
router.get('/anchored', async (req, res, next) => {
  log.debug(`→ GET /anchored depuis ${req.ip}`);
  try {
    const data = await anchorService.getAnchoredList();
    res.json(data);
    log.info('Liste des vols ancrés retournée');
  } catch (err) {
    log.error(`Erreur GET /anchored : ${err.message}`);
    next(err);
  }
});

// POST /anchor : ajoute un ancrage avec preuve ZIP
router.post('/anchor', upload.single('proofZip'), async (req, res, next) => {
  log.debug(`→ POST /anchor depuis ${req.ip}`);

  if (!req.is('multipart/form-data')) {
    log.warn('Type de contenu non multipart/form-data');
    return res.status(400).json({ error: 'Type de contenu invalide, attendez multipart/form-data' });
  }

  try {
    await anchorService.handlePostAnchor(req, res);
    log.info('Vol ancré avec succès');
  } catch (err) {
    log.error(`Erreur POST /anchor : ${err.message}`);
    next(err);
  }
});

module.exports = router;
