/**
 * Service de gestion de l’historique des vols.
 * Centralise lecture, écriture, ajout et export depuis le fichier JSON d'historique.
 */

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const { log } = require('../utils/logger'); // Logger centralisé
const { config } = require('../config');    // Import config centralisée

// Gestion du fichier historique avec support chemin absolu ou relatif
const rawFlightsHistoryFile = config.backend.flightsHistoryFile || 'flights_history.json';

const HISTORY_FILE = path.isAbsolute(rawFlightsHistoryFile)
  ? rawFlightsHistoryFile
  : path.resolve(__dirname, '..', rawFlightsHistoryFile);

/**
 * Lit et retourne la liste complète des vols dans l'historique.
 * Tolère un fichier vide ou corrompu en renvoyant []
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
    throw new Error('Impossible de lire l’historique des vols.');
  }
}

/**
 * Écrit la liste complète des vols dans l'historique (remplacement total).
 */
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
 * Ajoute plusieurs vols dans l’historique en évitant les doublons.
 */
async function addFlightsToHistory(flightsToAdd) {
  try {
    const history = await readAllFlightsFromHistory();
    let newEntries = 0;

    for (const flight of flightsToAdd) {
      const exists = history.some(f => f.id === flight.id && f.created_time === flight.created_time);
      if (!exists) {
        history.push(flight);
        newEntries++;
      }
    }

    if (newEntries > 0) {
      await writeFlightsHistory(history);
      log('info', `${newEntries} nouveau(x) vol(s) ajouté(s)`);
    } else {
      log('debug', 'Aucun nouveau vol ajouté');
    }
  } catch (error) {
    log('error', `Erreur ajout vols : ${error.message}`);
    throw error;
  }
}

/**
 * Ajoute un seul vol à l’historique.
 * @returns {Promise<boolean>} true si ajouté, false si déjà existant
 */
async function addSingleFlight(flight) {
  try {
    const history = await readAllFlightsFromHistory();
    const exists = history.some(f => f.id === flight.id && f.created_time === flight.created_time);

    if (!exists) {
      history.push(flight);
      await writeFlightsHistory(history);
      log('info', `Vol ajouté (id=${flight.id})`);
      return true;
    } else {
      log('warn', `Vol déjà présent (id=${flight.id})`);
      return false;
    }
  } catch (error) {
    log('error', `Erreur ajout vol unique : ${error.message}`);
    throw error;
  }
}

/**
 * Exporte un vol selon id et created_time.
 */
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
  log('debug', `→ GET /history depuis ${req.ip}`);
  try {
    const flights = await readAllFlightsFromHistory();
    return res.json(flights);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleAddSingle(req, res) {
  log('debug', `→ POST /history depuis ${req.ip}`);
  const flight = req.body;

  if (!flight.id || !flight.created_time || !flight.trace) {
    log('warn', 'Requête invalide : champs requis manquants');
    return res.status(400).json({ error: 'id, created_time et trace sont requis' });
  }

  try {
    const created = await addSingleFlight(flight);
    return res.json({ ok: true, created });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function handleExport(req, res) {
  const { id, created_time } = req.params;
  log('debug', `→ GET /export/${id}/${created_time} depuis ${req.ip}`);
  try {
    const flight = await exportFlight(id, created_time);
    if (!flight) {
      return res.status(404).json({ error: 'Vol non trouvé' });
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=drone_${id}_${created_time}.json`
    );
    return res.json(flight);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  readAllFlightsFromHistory,
  writeFlightsHistory,
  addFlightsToHistory,
  addSingleFlight,
  exportFlight,
  handleGetHistory,
  handleAddSingle,
  handleExport,
};
