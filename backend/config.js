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
    tracing {
      origin {
        lat
        lng
      }
      lastlen
      points
    }
    whitelisted
  }
}
`;

const config = {
  backend: {
    ignoreTlsErrors: process.env.IGNORE_TLS_ERRORS === 'true',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    maxJsonSize: process.env.MAX_JSON_SIZE || '5mb',
    port: parseIntOrDefault(process.env.BACKEND_PORT, 3200),
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    websocketPort: parseIntOrDefault(process.env.WEBSOCKET_PORT, 3200),
    useTestSim: process.env.USE_TEST_SIM === 'true',
    blockchainApiUrl: process.env.BLOCKCHAIN_API_URL || '',
    blockchainApiKey: process.env.BLOCKCHAIN_API_KEY || '',
    apiProtocol: process.env.API_PROTOCOL || 'http',
    apiHost: process.env.API_HOST || '192.168.1.100',
    apiPort: process.env.API_PORT || '3200',

    // Constantes déplacées ici
    inactiveTimeoutMs: 10000,
    maxTraceLength: 1000,
    distanceEpsilon: 0.00001,

    // Valeurs avancées (non modifiables via .env)
    graphqlDroneQuery: graphqlDroneQuery,
    maxUploadSizeMb: parseIntOrDefault(process.env.MAX_UPLOAD_SIZE_MB, 50),
    websocketMinDistance: parseFloatOrDefault(process.env.WEBSOCKET_MIN_DISTANCE, 0.0001),
    websocketSaveIntervalMs: parseIntOrDefault(process.env.WEBSOCKET_SAVE_INTERVAL_MS, 60000),
    websocketInactiveTimeoutMs: parseIntOrDefault(process.env.WEBSOCKET_INACTIVE_TIMEOUT_MS, 60000),
    archiveCheckIntervalMs: 15000,
    pollingIntervalMs: 2000,
    maxCachedFlights: 1000,
  }
};

module.exports = { config };
