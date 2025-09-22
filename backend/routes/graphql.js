const express = require('express');
const router = express.Router();
const { log } = require('../utils/logger'); // Logger centralisé
const flightsService = require('../services/flightService');
const { config } = require('../config'); // Import config centralisée
const fetch = require('node-fetch'); // Assurez-vous que node-fetch est installé

// Lecture des paramètres depuis config
const API_PROTOCOL = config.backend.apiProtocol || 'http';
const API_HOST = config.backend.apiHost || '192.168.1.100';
const API_PORT = config.backend.apiPort || '3200';

router.post('/graphql', async (req, res, next) => {
  log('debug', '→ POST /graphql reçu');

  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Requête GraphQL vide' });
    }

    const graphqlUrl = `${API_PROTOCOL}://${API_HOST}:${API_PORT}/graphql`;
    log('info', `Proxy → ${graphqlUrl}`);

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errText = await response.text();
      const errorMsg = `GraphQL distante : HTTP ${response.status} ${response.statusText} - ${errText}`;
      log('error', errorMsg);
      const error = new Error(errorMsg);
      error.statusCode = response.status;
      throw error;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      log('error', `Réponse non JSON : ${text}`);
      throw new Error(`Réponse distante inattendue`);
    }

    const data = await response.json();

    if (data?.data?.drone) {
      const drones = Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone];
      const nbVols = drones.length;
      await flightsService.addFlightsToHistory(drones);
      if (nbVols > 0) {
        log('info', `${nbVols} vol(s) ajouté(s) à l’historique`);
      } else {
        log('debug', 'Aucun nouveau vol');
      }
    } else {
      log('debug', 'Pas de donnée drone dans la réponse');
    }

    res.json(data);
  } catch (error) {
    log('error', `Erreur proxy GraphQL : ${error.message}`);
    next(error);
  }
});

module.exports = router;
