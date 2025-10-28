const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Ajoute ou met à jour une session de vol dans un fichier historique.
 * Fusionne les traces sans doublons,
 * garde le created_time initial,
 * repasse l'état en 'live' si le vol revient depuis 'waiting'.
 * @param {Object} flight - Vol à ajouter ou mettre à jour
 * @param {Array} historyFile - Tableau des sessions dans l'historique
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  // Recherche toutes les sessions existantes pour ce vol par id uniquement
  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  if (candidateSessions.length > 0) {
    // Choisir la session existante avec la plus ancienne created_time
    let oldestSession = candidateSessions[0];
    for (const session of candidateSessions) {
      if (new Date(session.created_time) < new Date(oldestSession.created_time)) {
        oldestSession = session;
      }
    }

    const idxToUpdate = historyFile.findIndex(
      f => f.id === oldestSession.id && f.created_time === oldestSession.created_time
    );

    const existing = historyFile[idxToUpdate];
    const existingTrace = Array.isArray(existing.trace) ? existing.trace : [];
    const newTrace = Array.isArray(flight.trace) ? flight.trace : [];

    // Fusionner traces sans doublons (lat, lng, timestamp)
    const mergedTrace = [...existingTrace];
    for (const pt of newTrace) {
      if (!mergedTrace.some(p => p[0] === pt[0] && p[1] === pt[1] && p[2] === pt[2])) {
        mergedTrace.push(pt);
      }
    }
    mergedTrace.sort((a,b) => a[2] - b[2]);

    // Mettre à jour session avec fusion, garder created_time d'origine
    historyFile[idxToUpdate] = {
      ...existing,
      ...flight,
      trace: mergedTrace,
      created_time: oldestSession.created_time,
      state: flight.state,  // Met à jour le state selon l'objet passé
    };

    log.debug(`[addOrUpdateFlightInFile] Trace length before update: ${newTrace.length} for drone ${flight.id}`);
    log.info(`[addOrUpdateFlightInFile] Updated session for drone ${flight.id} with created_time ${oldestSession.created_time} and merged trace length ${mergedTrace.length}`);

    return;
  }

  // Aucune session existante, création nouvelle
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;
  if (!flight.trace) flight.trace = [];

  historyFile.push(flight);

  log.info(`[addOrUpdateFlightInFile] Added new session for drone ${flight.id} with created_time ${newCreated} and trace length ${flight.trace.length}`);
}

module.exports = { addOrUpdateFlightInFile };
