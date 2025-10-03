const axios = require('axios');
const { config } = require('../config');
const log = require('../utils/logger');

/**
 * Vérifie si un vol donné est ancré dans la blockchain.
 * 
 * @param {string} flightId - Identifiant unique du vol drone.
 * @param {string} createdTime - Date/heure ISO de création du vol pour identification précise.
 * 
 * @returns {Promise<boolean>} - true si le vol est ancré, false sinon.
 * 
 * Note : Cette fonction fait une requête GET à l'endpoint blockchain API 
 * https://clearspace.databeam.eu/data/{flightId}/anchor 
 * avec la clé API en header X-API-KEY.
 * 
 * Cette fonction est asynchrone et peut lancer une erreur si la requête échoue.
 */
async function checkIfAnchored(flightId, createdTime) {
  const apiUrlBase = config.backend.blockchainApiUrl; // ex: "https://clearspace.databeam.eu"
  const apiKey = config.backend.blockchainApiKey; // clé API fournie en config
  if (!apiUrlBase) {
    log.warn('API blockchain non configurée (blockchainApiUrl manquant)');
    return false;
  }
  if (!flightId) {
    throw new Error('flightId est requis pour vérifier l’ancrage blockchain');
  }

  // Construire l'URL ciblée pour récupérer l'ancrage du vol spécifique
  const url = `${apiUrlBase}/data/${flightId}/anchor`;

  try {
    // Faire la requête GET à l'API REST avec clé d'authentification
    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': apiKey,
        'User-Agent': 'Clearspace-Backend', // éventuellement adapter User-Agent
      }
    });
    // Le serveur doit répondre avec un status 200 et un body contenant si ancré ou non
    if (response.status === 200 && response.data) {
      // Réponse attendue: { anchored: true } ou { anchored: false }
      const isAnchored = response.data.anchored;
      log.info(`Vol ${flightId} ancrage blockchain : ${isAnchored}`);
      return Boolean(isAnchored);
    } else {
      log.warn(`Réponse inattendue de l'API blockchain pour vol ${flightId} : status ${response.status}`);
      return false;
    }
  } catch (error) {
    // Log et propager l'erreur pour gestion en amont
    log.error(`Erreur lors de l'interrogation API blockchain pour vol ${flightId} : ${error.message}`);
    throw error;
  }
}

module.exports = {
  checkIfAnchored,
};
