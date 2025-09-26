const express = require('express');
const router = express.Router();
const { log } = require('../utils/logger');
const flightsService = require('../services/flightService');

/**
 * GET /history
 * Retourne l'historique complet des vols.
 */
router.get('/history', async (req, res, next) => {
  log('debug', `→ GET /history depuis ${req.ip}`);
  try {
    const flights = await flightsService.readAllFlightsFromHistory();
    return res.json(flights);
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

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Corps de requête vide' });
  }

  const flight = req.body;
  if (!flight.id || !flight.created_time || !flight.trace) {
    return res.status(400).json({ error: 'id, created_time et trace sont requis' });
  }

  try {
    await flightsService.saveOrUpdate(flight);
    log('info', `Vol ajouté à l’historique : id=${flight.id}`);
    return res.json({ ok: true });
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
    const flight = await flightsService.exportFlight(id, created_time);
    if (!flight) {
      return res.status(404).json({ error: 'Vol non trouvé' });
    }
    res.setHeader('Content-Disposition', `attachment; filename=drone_${id}_${created_time}.json`);
    return res.json(flight);
  } catch (error) {
    log('error', `Erreur export vol id=${id} : ${error.message}`);
    next(error);
  }
});

module.exports = router;
