const express = require('express');
const cors = require('cors');
const path = require('path');

const { log } = require('./utils/logger'); // Logger centralisé
const { config } = require('./config');   // Import du fichier config.js

// Middlewares personnalisés
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

// Création de l'application Express
const app = express();

/* =====================
   CONFIGURATION GLOBALE
===================== */

// Désactivation TLS uniquement si demandé dans config (dev uniquement)
if (config.backend.ignoreTlsErrors) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  log('warn', '⚠️ TLS désactivé (IGNORE_TLS_ERRORS=true)');
}

// Configuration CORS
app.use(cors({ origin: config.backend.corsOrigin }));

// Middleware JSON pour parser les requêtes entrantes
app.use(express.json({ limit: config.backend.maxJsonSize }));

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
const port = config.backend.port;

app.listen(port, () => {
  log('info', `✅ Backend DroneWeb démarré sur http://localhost:${port}`);
});
