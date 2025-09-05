/**
 * server.js 
 * Point d'entrée du backend DroneWeb
 * - Configure Express
 * - Charge les middlewares globaux (CORS, JSON parsing)
 * - Monte les routes
 * - Gère les erreurs et routes inconnues
 */

require('dotenv').config(); // Charger les variables d'environnement en priorité

const express = require('express');
const cors = require('cors');
const path = require('path');

const { log } = require('./utils/logger'); // ✅ Logger centralisé

// Middlewares personnalisés
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

// Création de l'application Express
const app = express();

/* =====================
   CONFIGURATION GLOBALE
===================== */

// Désactivation TLS uniquement si demandé dans .env (DEV UNIQUEMENT)
if (process.env.IGNORE_TLS_ERRORS === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log('warn', '⚠️ TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

// Configuration CORS
// En prod, définir CORS_ORIGIN=https://monfrontprod.com dans .env
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Middleware JSON pour parser les requêtes entrantes
app.use(express.json({ limit: process.env.MAX_JSON_SIZE || '5mb' }));

/* =====================
   ROUTES PRINCIPALES
===================== */
const apiRoutes = require('./routes');
app.use(apiRoutes);

/* =====================
   GESTION DES 404 & ERREURS
===================== */
app.use(notFoundHandler); // Route non trouvée => 404
app.use(errorHandler);    // Gestion des erreurs

/* =====================
   LANCEMENT DU SERVEUR
===================== */
const port = process.env.BACKEND_PORT || 3200;

app.listen(port, () => {
  log('info', `✅ Backend DroneWeb démarré sur http://localhost:${port}`);
});
