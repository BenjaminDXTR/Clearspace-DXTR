const log = require('./utils/logger');
const { config } = require('./config');
const systemStatus = require('./utils/systemStatus'); // Import module systemStatus
const fetch = require('node-fetch'); // Assure-toi que node-fetch est disponible

async function fetchDroneData() {
  const API_PROTOCOL = config.backend.apiProtocol || 'http';
  const API_HOST = config.backend.apiHost || '192.168.1.100';
  const API_PORT = config.backend.apiPort || '3200';
  const graphqlUrl = `${API_PROTOCOL}://${API_HOST}:${API_PORT}/graphql`;

  const query = config.backend.graphqlDroneQuery;

  log.debug(`graphqlClient: Envoi requête vers ${graphqlUrl} avec query : ${query}`);

  const startTime = Date.now();

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const duration = Date.now() - startTime;
    log.debug(`graphqlClient: Réponse HTTP ${response.status} ${response.statusText} reçue en ${duration} ms`);

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`graphqlClient: Erreur réponse depuis ${graphqlUrl} : ${errorText}`);

      // Met à jour le statut graphqlAccess comme échec
      systemStatus.updateSystemStatus({ graphqlAccess: { ok: false, lastError: `HTTP ${response.status} ${response.statusText}` } });

      throw new Error(`API Erreur: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Met à jour le statut graphqlAccess comme succès
    systemStatus.updateSystemStatus({ graphqlAccess: { ok: true, lastError: null } });

    if (config.backend.nodeEnv !== 'production') {
      log.debug(`graphqlClient: Corps réponse reçu (début 500 caractères) : ${JSON.stringify(data).slice(0, 500)}`);
    }

    return data;
  } catch (error) {
    log.error(`graphqlClient: Erreur lors fetchDroneData vers ${graphqlUrl} : ${error.message}`);

    // Met à jour le statut graphqlAccess comme échec avec message d'erreur
    systemStatus.updateSystemStatus({ graphqlAccess: { ok: false, lastError: error.message } });

    throw error;
  }
}

module.exports = { fetchDroneData };
