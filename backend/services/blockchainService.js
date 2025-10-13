const axios = require('axios');
const FormData = require('form-data');
const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Envoie la preuve ZIP et le JSON ancrage vers l'API distante blockchain.
 * 
 * @param {Buffer} zipBuffer - Contenu du fichier preuve.zip (Buffer)
 * @param {Buffer} jsonBuffer - Contenu du fichier ancrage.json (Buffer)
 * @returns {Promise<Object>} - Réponse JSON de l'API blockchain
 */
async function sendAnchorProof(zipBuffer, jsonBuffer) {
  const apiUrl = config.backend.blockchainApiUrl + '/data';
  const apiKey = config.backend.blockchainApiKey;

  if (!apiUrl || !apiKey) {
    throw new Error('API Blockchain URL ou clé API non configurées');
  }

  // Construire le formulaire multipart/form-data
  const form = new FormData();
  form.append('file', zipBuffer, {
    filename: 'preuve.zip',
    contentType: 'application/zip',
  });
  form.append('data', jsonBuffer, {
    filename: 'ancrage.json',
    contentType: 'application/json',
  });

  try {
    // Envoyer la requête POST avec Axios
    const response = await axios.post(apiUrl, form, {
      headers: {
        ...form.getHeaders(),
        'X-API-KEY': apiKey,
        'User-Agent': 'Clearspace-Backend',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    log.info(`Preuve envoyée, statut HTTP: ${response.status}`);
    return response.data;
  } catch (error) {
    log.error(`Erreur envoi preuve blockchain : ${error.message}`);
    throw error;
  }
}

module.exports = {
  sendAnchorProof,
};
