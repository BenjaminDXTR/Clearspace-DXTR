const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const parseIntOrDefault = (value, defaultValue) => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseFloatOrDefault = (value, defaultValue) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Chargement et parsing de la requête GraphQL drone depuis .env
let graphqlDroneQueryRaw = process.env.GRAPHQL_DRONE_QUERY || '';
let graphqlDroneQuery = graphqlDroneQueryRaw;

try {
  if (graphqlDroneQueryRaw) {
    graphqlDroneQuery = graphqlDroneQueryRaw.trim();
  } else {
    graphqlDroneQuery = `{ drone { id latitude longitude tracing created_time } }`;
  }
} catch (e) {
  graphqlDroneQuery = `{ drone { id latitude longitude tracing created_time } }`;
}

const config = {
  backend: {
    ignoreTlsErrors: process.env.IGNORE_TLS_ERRORS === 'true',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    maxJsonSize: process.env.MAX_JSON_SIZE || '5mb',
    port: parseIntOrDefault(process.env.BACKEND_PORT, 3200),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    maxUploadSizeMb: parseIntOrDefault(process.env.MAX_UPLOAD_SIZE_MB, 50),
    apiProtocol: process.env.API_PROTOCOL || 'http',
    apiHost: process.env.API_HOST || '192.168.1.100',
    apiPort: process.env.API_PORT || '3200',
    anchoredDir: process.env.ANCHORED_DIR || 'anchored',
    anchorFile: process.env.ANCHOR_FILE || 'anchored.json',
    flightsHistoryFile: process.env.FLIGHTS_HISTORY_FILE || 'flights_history.json',
    websocketPort: parseIntOrDefault(process.env.WEBSOCKET_PORT, 3200),
    websocketMinDistance: parseFloatOrDefault(process.env.WEBSOCKET_MIN_DISTANCE, 0.0001),
    websocketSaveIntervalMs: parseIntOrDefault(process.env.WEBSOCKET_SAVE_INTERVAL_MS, 60000),

    // Ajout de la nouvelle variable pour délai d’inactivité
    websocketInactiveTimeoutMs: parseIntOrDefault(process.env.WEBSOCKET_INACTIVE_TIMEOUT_MS, 60000),

    blockchainApiUrl: process.env.BLOCKCHAIN_API_URL || '',
    blockchainApiKey: process.env.BLOCKCHAIN_API_KEY || '',

    graphqlDroneQuery: graphqlDroneQuery,
  },

  frontend: {
    port: parseIntOrDefault(process.env.FRONTEND_PORT, 3000),
    apiUrl: process.env.VITE_API_URL || 'http://localhost:3200',
    debug: process.env.VITE_DEBUG === 'true',
    maxHistoryLength: parseIntOrDefault(process.env.VITE_MAX_HISTORY_LENGTH, 100),
    inactiveTimeout: parseIntOrDefault(process.env.VITE_INACTIVE_TIMEOUT, 10000),
    iconUrlDroneLive: process.env.VITE_ICON_URL_DRONE_LIVE || '',
    iconUrlDroneStart: process.env.VITE_ICON_URL_DRONE_START || '',
    iconSizeDefault: (process.env.VITE_ICON_SIZE_DEFAULT || '36,36').split(',').map(Number),
    iconSizeHistory: (process.env.VITE_ICON_SIZE_HISTORY || '28,28').split(',').map(Number),
  },
};

module.exports = { config };
