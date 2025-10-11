const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Ajoute ou met à jour une session de vol dans un fichier historique.
 * @param {Object} flight - Objet vol avec données dont id et created_time
 * @param {Array} historyFile - Tableau des sessions de vol existantes dans le fichier
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  const now = Date.now();

  // Seuil d'inactivité pour regrouper/mettre à jour des sessions proches dans le temps
  const INACTIVE_TIMEOUT = config.backend.inactiveTimeoutMs;
  // Suppression de la limite de longueur de trace, on conserve tout

  // Cherche les sessions du même vol dans le fichier courant
  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  let idxToUpdate = -1;
  let selectedCreatedTime = flight.created_time;

  // Boucle sur les sessions candidates pour chercher celle à mettre à jour
  for (let i = 0; i < candidateSessions.length; i++) {
    const session = candidateSessions[i];
    const sessionCreated = new Date(session.created_time).getTime();
    const incomingCreated = new Date(flight.created_time).getTime();

    const timeDiff = Math.abs(incomingCreated - sessionCreated);

    // Si la session est dans le délai d'inactivité et en état 'live'
    if (timeDiff <= INACTIVE_TIMEOUT && session.state === 'live') {
      // Conserve la date de création la plus ancienne
      if (sessionCreated < new Date(selectedCreatedTime).getTime()) {
        selectedCreatedTime = session.created_time;
      }
      // Index de mise à jour dans le fichier historique
      idxToUpdate = historyFile.findIndex(
        f => f.id === flight.id && f.created_time === session.created_time
      );
      break;
    }
  }

  if (idxToUpdate !== -1) {
    // Copie de la trace existante ou vide pour mettre à jour
    let newTrace = Array.isArray(flight.trace) ? flight.trace.slice() : [];

    // Log de la longueur avant mise à jour
    log.debug(`[addOrUpdateFlightInFile] Trace length before update: ${newTrace.length} for drone ${flight.id}`);

    // Fusion des données mises à jour avec celles existantes
    const updatedFlight = {
      ...historyFile[idxToUpdate],
      ...flight,
      trace: newTrace,
      created_time: selectedCreatedTime,
    };

    // Mise à jour dans le fichier en mémoire
    historyFile[idxToUpdate] = updatedFlight;

    log.info(`[addOrUpdateFlightInFile] Updated session for drone ${flight.id} with created_time ${selectedCreatedTime}`);
    return;
  }

  // Nouvelle session si pas de mise à jour possible
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;

  if (!flight.trace) {
    flight.trace = [];
  }

  // Ajout au fichier
  historyFile.push(flight);

  log.info(`[addOrUpdateFlightInFile] Added new session for drone ${flight.id} with created_time ${newCreated} and trace length ${flight.trace.length}`);
}

module.exports = { addOrUpdateFlightInFile };
