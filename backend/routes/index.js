/**
 * Routeur global de l'API backend DroneWeb
 * Regroupe l'ensemble des sous-routers :
 * - historyRoutes
 * - anchorRoutes
 * - graphqlRoutes
 */

const express = require('express');
const router = express.Router();
const { log } = require('../utils/logger'); // Logger centralisé

// Import des modules de routes
const historyRoutes = require('./history');
const anchorRoutes = require('./anchor');
const graphqlRoutes = require('./graphql');

/**
 * Middleware global de log pour toutes les requêtes reçues par l'API.
 * Niveau : debug (visible uniquement si LOG_LEVEL=debug)
 */
router.use((req, res, next) => {
  log('debug', `${req.method} ${req.originalUrl} depuis ${req.ip}`);
  next();
});

/**
 * Montage des sous-routers
 * Chaque module gère ses propres endpoints
 * (option : préfixer par /api pour isoler la couche API du reste du site)
 */
router.use(historyRoutes);
router.use(anchorRoutes);
router.use(graphqlRoutes);

// Exemple si tu veux mettre un préfixe API unique :
// router.use('/api', historyRoutes);
// router.use('/api', anchorRoutes);
// router.use('/api', graphqlRoutes);

module.exports = router;
