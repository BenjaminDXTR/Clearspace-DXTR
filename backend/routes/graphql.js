const express = require('express');
const router = express.Router();
const { log } = require('../utils/logger');
const flightsService = require('../services/flightService');
const { config } = require('../config');
const fetch = require('node-fetch');

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

      for (const drone of drones) {
        // Ajout obligatoire du champ _type si absent, ici par defaut "live"
        if (!drone._type) {
          drone._type = "live";
        }
        
        if (!drone.trace || !Array.isArray(drone.trace) || drone.trace.length === 0) {
          if (
            typeof drone.latitude === "number" &&
            typeof drone.longitude === "number" &&
            !isNaN(drone.latitude) &&
            !isNaN(drone.longitude)
          ) {
            drone.trace = [[drone.latitude, drone.longitude]];
            log('warn', `Vol ID=${drone.id} - trace manquante remplacée par position actuelle`);
          } else {
            // Selon le besoin, on pourrait sauter ce drone ou continuer sans trace
            drone.trace = [];
            log('warn', `Vol ID=${drone.id} - trace invalide remplacée par tableau vide`);
          }
        }

        await flightsService.saveOrUpdateFlight(drone);
      }

      if (nbVols > 0) {
        log('info', `${nbVols} vol(s) ajouté(s) ou mis à jour dans l’historique`);
      } else {
        log('debug', 'Aucun nouveau vol');
      }
    }


    res.json(data);
  } catch (error) {
    log('error', `Erreur proxy GraphQL : ${error.message}`);
    next(error);
  }
});

module.exports = router;
