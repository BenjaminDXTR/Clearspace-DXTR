const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const { log } = require('../utils/logger');
const { config } = require('../config');

const HISTORY_FILE = path.isAbsolute(config.backend.flightsHistoryFile || 'flights_history.json')
  ? config.backend.flightsHistoryFile
  : path.resolve(__dirname, '..', config.backend.flightsHistoryFile || 'flights_history.json');

/**
 * Lecture complète des données de vols depuis le fichier JSON d'historique.
 * Retourne une liste d'objets vol.
 */
async function readAllFlightsFromHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      log('debug', 'Aucun historique trouvé.');
      return [];
    }
    const content = await fsPromises.readFile(HISTORY_FILE, 'utf-8');
    try {
      const flights = JSON.parse(content);
      log('info', `Historique chargé : ${flights.length} vol(s)`);
      return flights;
    } catch (parseErr) {
      log('error', `Fichier ${HISTORY_FILE} corrompu : ${parseErr.message}`);
      return [];
    }
  } catch (error) {
    log('error', `Erreur lecture ${HISTORY_FILE} : ${error.message}`);
    throw new Error('Impossible de lire l\'historique des vols.');
  }
}

/**
 * Écriture complète du fichier historique JSON.
 */
async function writeFlightsHistory(flights) {
  try {
    await fsPromises.writeFile(HISTORY_FILE, JSON.stringify(flights, null, 2));
    log('info', `Historique sauvegardé (${flights.length} vol(s))`);
  } catch (error) {
    log('error', `Erreur écriture ${HISTORY_FILE} : ${error.message}`);
    throw new Error('Impossible de sauvegarder l\'historique.');
  }
}

/**
 * Ajoute ou met à jour un vol dans l'historique.
 * Vérifie la validité minimale du modèle.
 */
async function saveOrUpdate(flight) {
  try {
    log(`saveOrUpdate reçu : id=${flight.id}, _type=${flight._type}, created=${flight.created_time}`);

    if (!flight.id || !flight.created_time || !flight.trace) {
      throw new Error('Données vol incomplètes');
    }

    if (typeof flight.latitude === 'number' && typeof flight.longitude === 'number' && !Array.isArray(flight.trace)) {
      flight.trace = [[flight.latitude, flight.longitude]];
      log('warn', `Trace ajustée avec position actuelle: vol ${flight.id}`);
    }

    if (!['live', 'local'].includes(flight._type)) {
      throw new Error('Type _type invalide');
    }

    const flights = await readAllFlightsFromHistory();
    const index = flights.findIndex(f => f.id === flight.id && f.created_time === flight.created_time);

    if (index >= 0) {
      flights[index] = flight;
      log(`Vol mis à jour : ${flight.id}`);
    } else {
      flights.push(flight);
      log(`Nouveau vol ajouté : ${flight.id}`);
    }

    await writeFlightsHistory(flights);
  } catch (error) {
    log('error', 'Erreur saveOrUpdate:', error);
    throw error;
  }
}

/**
 * Permet d'exporter un vol JSON donné par son id et sa création.
 */
async function exportFlight(id, created_time) {
  try {
    const flights = await readAllFlightsFromHistory();
    const flight = flights.find(f => f.id === id && f.created_time === created_time);

    if (!flight) {
      log('warn', `Vol non trouvé pour export : id=${id}, created_time=${created_time}`);
      return null;
    }

    log('info', `Export vol : id=${id}, created_time=${created_time}`);
    return flight;
  } catch (error) {
    log('error', `Erreur export vol : ${error.message}`);
    throw error;
  }
}

/**
 * Handlers Express pour API vol / historique.
 */
async function handleGetHistory(req, res) {
  try {
    const flights = await readAllFlightsFromHistory();
    log('info', `GET /history retourne ${flights.length} vols`);
    res.json(flights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleAddFlight(req, res) {
  try {
    const flight = req.body;
    if (!flight || !flight.id || !flight.created_time || !flight.trace) {
      return res.status(400).json({ error: 'Données vol invalides' });
    }
    await saveOrUpdate(flight);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function handleExportFlight(req, res) {
  try {
    const { id, created_time } = req.params;
    const flight = await exportFlight(id, created_time);
    if (!flight) {
      return res.status(404).json({ error: 'Vol non trouvé' });
    }
    res.setHeader('Content-Disposition', `attachment; filename=drone_${id}_${created_time}.json`);
    res.json(flight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  readAllFlightsFromHistory,
  writeFlightsHistory,
  saveOrUpdate,
  exportFlight,
  handleGetHistory,
  handleAddFlight,
  handleExportFlight,
};
