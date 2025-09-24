const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const { log } = require('../utils/logger');
const { config } = require('../config');

const rawFlightsHistoryFile = config.backend.flightsHistoryFile || 'flights_history.json';

const HISTORY_FILE = path.isAbsolute(rawFlightsHistoryFile)
  ? rawFlightsHistoryFile
  : path.resolve(__dirname, '..', rawFlightsHistoryFile);

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
    throw new Error('Impossible de lire l’historique des vols.');
  }
}

async function writeFlightsHistory(flights) {
  try {
    await fsPromises.writeFile(HISTORY_FILE, JSON.stringify(flights, null, 2));
    log('info', `Historique sauvegardé (${flights.length} vol(s))`);
  } catch (error) {
    log('error', `Erreur écriture ${HISTORY_FILE} : ${error.message}`);
    throw new Error('Impossible de sauvegarder l’historique.');
  }
}

/**
 * Ajoute ou met à jour un vol dans l'historique avec son _type dynamique (live/local).
 * Le vol doit contenir trace valide ou position actuelle.
 */
async function saveOrUpdateFlight(newFlight) {
  try {
    if (!newFlight.trace || !Array.isArray(newFlight.trace) || newFlight.trace.length === 0) {
      if (
        typeof newFlight.latitude === "number" &&
        typeof newFlight.longitude === "number" &&
        !isNaN(newFlight.latitude) &&
        !isNaN(newFlight.longitude)
      ) {
        newFlight.trace = [[newFlight.latitude, newFlight.longitude]];
        log('warn', `Vol ${newFlight.id} trace remplacée par position`);
      } else {
        throw new Error("Trace invalide");
      }
    }

    if (!newFlight._type || !["live", "local"].includes(newFlight._type)) {
      throw new Error("Champ _type invalide");
    }

    const flights = await readAllFlightsFromHistory();

    const index = flights.findIndex(f =>
      f.id === newFlight.id && f.created_time === newFlight.created_time
    );

    if (index !== -1) {
      flights[index] = newFlight;
      log(`Vol ${newFlight.id} mis à jour, type: ${newFlight._type}`);
    } else {
      flights.push(newFlight);
      log(`Vol ${newFlight.id} ajouté, type: ${newFlight._type}`);
    }

    await writeFlightsToFile(flights);
  } catch (e) {
    log("Erreur saveOrUpdateFlight:", e);
    throw e;
  }
}

async function exportFlight(id, created_time) {
  try {
    const history = await readAllFlightsFromHistory();
    const flight = history.find(f => f.id === id && f.created_time === created_time);
    if (!flight) {
      log('warn', `Export raté : vol introuvable (id=${id}, created_time=${created_time})`);
      return null;
    }
    log('info', `Export vol (id=${id}, created_time=${created_time})`);
    return flight;
  } catch (error) {
    log('error', `Erreur export vol : ${error.message}`);
    throw error;
  }
}

//////////////////////
// HANDLERS EXPRESS //
//////////////////////

async function handleGetHistory(req, res) {
  try {
    const flights = await readAllFlightsFromHistory();
    return res.json(flights);
  } catch (error) {
    log('error', `Erreur GET /history : ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

async function handleAddSingle(req, res) {
  const flight = req.body;

  if (!flight.id || !flight.created_time || !flight.trace) {
    log('warn', 'Requête POST /history invalide : champs requis manquants');
    return res.status(400).json({ error: 'id, created_time et trace sont requis' });
  }

  try {
    await saveOrUpdateFlight(flight);
    return res.json({ ok: true });
  } catch (error) {
    log('error', `Erreur POST /history : ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

async function handleExport(req, res) {
  const { id, created_time } = req.params;
  try {
    const flight = await exportFlight(id, created_time);
    if (!flight) {
      return res.status(404).json({ error: 'Vol non trouvé' });
    }
    res.setHeader('Content-Disposition', `attachment; filename=drone_${id}_${created_time}.json`);
    return res.json(flight);
  } catch (error) {
    log('error', `Erreur GET /export : ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  readAllFlightsFromHistory,
  writeFlightsHistory,
  saveOrUpdateFlight,
  exportFlight,
  handleGetHistory,
  handleAddSingle,
  handleExport,
};
