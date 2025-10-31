const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const parseIntOrNull = (value) => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
};

const parseFloatOrNull = (value) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

const graphqlDroneQuery = `
{
  drone {
    altitude
    attack_bands
    blacklisted
    confirmed
    created_time
    deleted_time
    description
    direction
    distance
    height
    id
    initial_location {
      lat
      lng
    }
    lastseen
    lastseen_time
    latitude
    localization {
      lat
      lng
    }
    longitude
    name
    rc_location {
      lat
      lng
    }
    seen_sensor {
      bandwidth_khz
      detected_freq_khz
      signal_dbm
      port
      snr_dB
      noise_dbm
      sensor_id
    }
    speed
    whitelisted
  }
}
`;

// Helper to parse comma-separated env var or return null if empty
const parseCommaListOrNull = (value) => {
  if (!value || value.trim() === '') return null;
  return value.split(',').map(v => v.trim());
};

const allowedIps = parseCommaListOrNull(process.env.ALLOWED_IPS);
const allowedOrigins = parseCommaListOrNull(process.env.ALLOWED_ORIGINS);

const config = {
  backend: {
    ignoreTlsErrors: process.env.IGNORE_TLS_ERRORS === 'true' ? true : false, // For security, defaults to false unless explicitly true in .env
    corsOrigin: process.env.CORS_ORIGIN || null,
    maxJsonSize: process.env.MAX_JSON_SIZE || '20mb', 
    port: parseIntOrNull(process.env.BACKEND_PORT), 
    nodeEnv: process.env.NODE_ENV || 'production',
    logLevel: process.env.LOG_LEVEL || 'error',
    websocketPort: parseIntOrNull(process.env.WEBSOCKET_PORT), // No default port, use backend port or none
    useTestSim: process.env.USE_TEST_SIM === 'true', // Default is false unless explicitly true

    // Configuration API blockchain from .env only
    blockchainApiUrl: process.env.BLOCKCHAIN_API_URL || null,
    blockchainApiKey: process.env.BLOCKCHAIN_API_KEY || null,
    retryIntervalMin: parseIntOrNull(process.env.RETRY_INTERVAL_MIN) || 10,

    // Optional manual API composition
    apiProtocol: process.env.API_PROTOCOL || null,
    apiHost: process.env.API_HOST || null,
    apiPort: process.env.API_PORT || null,

    // Internal constants defined in code because not environment variables
    inactiveTimeoutMs: 10000,
    distanceEpsilon: 0.00001,

    graphqlDroneQuery: graphqlDroneQuery,
    maxUploadSizeMb: parseIntOrNull(process.env.MAX_UPLOAD_SIZE_MB) || 50, // sane default for uploads
    websocketMinDistance: parseFloatOrNull(process.env.WEBSOCKET_MIN_DISTANCE) || 0.0001,
    websocketSaveIntervalMs: parseIntOrNull(process.env.WEBSOCKET_SAVE_INTERVAL_MS) || 60000,
    websocketInactiveTimeoutMs: parseIntOrNull(process.env.WEBSOCKET_INACTIVE_TIMEOUT_MS) || 60000,
    archiveCheckIntervalMs: 15000,
    pollingIntervalMs: 1000,
    maxCachedFlights: 1000,

    // Allowed lists or null if empty
    allowedIps: allowedIps,
    allowedOrigins: allowedOrigins,
  }
};

module.exports = { config };
