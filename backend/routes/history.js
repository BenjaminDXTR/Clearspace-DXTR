/**
 * Routes pour la gestion de l'historique des vols.
 * S'appuie sur flightService pour la logique métier.
 */

const express = require('express');
const router = express.Router();
const { log } = require('../utils/logger'); // Logger centralisé
const flightsService = require('../services/flightService');

/**
 * GET /history
 * Retourne l'historique complet des vols.
 */
router.get('/history', async (req, res, next) => {
  log('debug', `→ GET /history depuis ${req.ip}`);
  try {
    await flightsService.handleGetHistory(req, res);
  } catch (error) {
    log('error', `Erreur GET /history : ${error.message}`);
    next(error);
  }
});

/**
 * POST /history
 * Ajoute un vol complet à l’historique.
 */
router.post('/history', async (req, res, next) => {
  log('debug', `→ POST /history depuis ${req.ip}`);

  // Validation basique
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Corps de requête vide' });
  }

  try {
    await flightsService.handleAddSingle(req, res);
    log('info', 'Vol ajouté à l’historique');
  } catch (error) {
    log('error', `Erreur POST /history : ${error.message}`);
    next(error);
  }
});

/**
 * GET /export/:id/:created_time
 * Exporte un vol JSON selon son id et sa date de création.
 */
router.get('/export/:id/:created_time', async (req, res, next) => {
  const { id, created_time } = req.params;
  log('debug', `→ GET /export/${id}/${created_time} depuis ${req.ip}`);

  if (!id || !created_time) {
    return res.status(400).json({ error: 'Paramètres id et created_time requis' });
  }

  try {
    await flightsService.handleExport(req, res);
    log('info', `Export vol id=${id}`);
  } catch (error) {
    log('error', `Erreur export vol id=${id} : ${error.message}`);
    next(error);
  }
});

module.exports = router;
