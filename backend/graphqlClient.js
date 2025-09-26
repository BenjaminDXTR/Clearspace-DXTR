const fetch = require('node-fetch');
const { log } = require('./utils/logger');
const { config } = require('./config');

async function fetchDroneData() {
  const API_PROTOCOL = config.backend.apiProtocol || 'http';
  const API_HOST = config.backend.apiHost || '192.168.1.100';
  const API_PORT = config.backend.apiPort || '3200';
  const graphqlUrl = `${API_PROTOCOL}://${API_HOST}:${API_PORT}/graphql`;

  const query = config.backend.graphqlDroneQuery;

  log(`graphqlClient: Envoi requête vers ${graphqlUrl} avec query : ${query}`);

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    log(`graphqlClient: Réponse HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) throw new Error(`API Erreur: ${response.status} ${response.statusText}`);

    const data = await response.json();
    log(`graphqlClient: Corps réponse reçu : ${JSON.stringify(data).slice(0, 500)}`);

    return data;
  } catch (error) {
    log('error', `graphqlClient: Erreur lors fetchDroneData : ${error.message}`);
    throw error;
  }
}

module.exports = { fetchDroneData };
