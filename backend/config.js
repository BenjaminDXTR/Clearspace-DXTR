// Configuration backend, chargement des variables d'environnement via dotenv

const path = require('path');
// Charge les variables du fichier .env situé à la racine du projet
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = {
  backend: {
    // Ignore les erreurs TLS (utile en dev uniquement)
    ignoreTlsErrors: process.env.IGNORE_TLS_ERRORS === 'true',

    // Origines CORS autorisées
    corsOrigin: process.env.CORS_ORIGIN || '*',

    // Taille max des requêtes JSON acceptées
    maxJsonSize: process.env.MAX_JSON_SIZE || '5mb',

    // Port sur lequel le backend écoute
    port: parseInt(process.env.BACKEND_PORT, 10) || 3200,

    // Environnement d'exécution (development, production, test...)
    nodeEnv: process.env.NODE_ENV || 'development',

    // Niveau de log (info, warn, error, debug)
    logLevel: process.env.LOG_LEVEL || 'info',

    // Taille max des uploads en Mo
    maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 50,

    // Configuration API distante (GraphQL ou autre)
    apiProtocol: process.env.API_PROTOCOL || 'http',
    apiHost: process.env.API_HOST || '192.168.1.100',
    apiPort: process.env.API_PORT || '3200',

    // Paramètres fichiers liés aux ancrages et historiques
    anchoredDir: process.env.ANCHORED_DIR || 'anchored',
    anchorFile: process.env.ANCHOR_FILE || 'anchored.json',
    flightsHistoryFile: process.env.FLIGHTS_HISTORY_FILE || 'flights_history.json',

    // Variables additionnelles à ajouter si besoin pour clés d'API, etc.
  },
};

module.exports = { config };
