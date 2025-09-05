/**
 * Routes pour la gestion des ancrages
 * - Consultation liste des vols ancrés
 * - Ajout/ancrage d'un vol avec fichier preuve
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { log } = require('../utils/logger'); // Logger centralisé

// Limite taille fichier : 50 Mo
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } });

const anchorService = require('../services/anchorService');

/**
 * GET /anchored - liste des vols ancrés
 */
router.get('/anchored', async (req, res, next) => {
  log('debug', `→ GET /anchored depuis ${req.ip}`);
  try {
    await anchorService.handleGetAnchored(req, res);
    log('info', 'Liste des vols ancrés retournée');
  } catch (error) {
    log('error', `Erreur GET /anchored : ${error.message}`);
    next(error);
  }
});

/**
 * POST /anchor - ancrage avec preuve ZIP
 */
router.post('/anchor', upload.single('proofZip'), async (req, res, next) => {
  log('debug', `→ POST /anchor depuis ${req.ip}`);

  if (!req.is('multipart/form-data')) {
    log('warn', 'Type de contenu invalide (attendu multipart/form-data)');
    return res.status(400).json({ error: 'Type de contenu invalide : utilisez multipart/form-data' });
  }

  try {
    await anchorService.handlePostAnchor(req, res);
    log('info', 'Vol ancré avec succès');
  } catch (error) {
    log('error', `Erreur POST /anchor : ${error.message}`);
    next(error);
  }
});

module.exports = router;
