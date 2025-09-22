require('dotenv').config();

const config = {
  backend: {
    ignoreTlsErrors: process.env.IGNORE_TLS_ERRORS === 'true',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    maxJsonSize: process.env.MAX_JSON_SIZE || '5mb',
    port: parseInt(process.env.BACKEND_PORT, 10) || 3200,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    maxUploadSizeMb: parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 50,
    apiProtocol: process.env.API_PROTOCOL || 'http',
    apiHost: process.env.API_HOST || '192.168.1.100',
    apiPort: process.env.API_PORT || '3200',
    anchoredDir: process.env.ANCHORED_DIR || 'anchored',
    anchorFile: process.env.ANCHOR_FILE || 'anchored.json',
  },
};

module.exports = { config };
