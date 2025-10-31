const axios = require('axios');
const FormData = require('form-data');
const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Envoie la preuve ZIP et le JSON d'ancrage vers l'API distante blockchain.
 * @param {Buffer} zipBuffer - Contenu du fichier preuve.zip (Buffer)
 * @param {Buffer} jsonBuffer - Contenu du fichier JSON principal d'ancrage (Buffer)
 * @returns {Promise<Object>} - Réponse JSON de l'API blockchain
 */
async function sendAnchorProof(zipBuffer, jsonBuffer) {
  const apiUrl = config.backend.blockchainApiUrl + '/data';
  const apiKey = config.backend.blockchainApiKey;

  if (!apiUrl || !apiKey) {
    throw new Error('API Blockchain URL ou clé API non configurées');
  }

  const form = new FormData();
  form.append('file', zipBuffer, {
    filename: 'preuve.zip',     // nom du fichier ZIP envoyé (le backend blockchain attend un fichier ZIP)
    contentType: 'application/zip',
  });
  form.append('data', jsonBuffer, {
    filename: 'ancrage.json',   // nom du fichier JSON principal d’ancrage envoyé
    contentType: 'application/json',
  });

  try {
    const response = await axios.post(apiUrl, form, {
      headers: {
        ...form.getHeaders(),
        'X-API-KEY': apiKey,
        'User-Agent': 'Clearspace-Backend',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 5000, // Timeout optionnel
    });
    log.info(`Preuve envoyée, statut HTTP: ${response.status}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      log.error(`Erreur API blockchain ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else {
      log.error(`Erreur envoi preuve blockchain : ${error.message}`);
    }
    throw error;
  }
}

async function checkBlockchainAccess() {
  try {
    const response = await axios.get(blockchainApiUrl, {
      headers: {
        'User-Agent': 'clearspace-backend',
        'X-API-KEY': blockchainApiKey,
      },
      timeout: 5000,
    });

    if (response.status === 200) {
      log.info('Blockchain access: OK');
      systemStatus.updateSystemStatus({ blockchainAccess: { ok: true, lastError: null } });
      return true;
    } else {
      log.warn(`Blockchain access returned status ${response.status}`);
      systemStatus.updateSystemStatus({ blockchainAccess: { ok: false, lastError: `Status ${response.status}` } });
      return false;
    }
  } catch (error) {
    log.error(`Blockchain access error: ${error.message}`);
    systemStatus.updateSystemStatus({ blockchainAccess: { ok: false, lastError: error.message } });
    return false;
  }
}


module.exports = {
  sendAnchorProof,
  checkBlockchainAccess,
};
