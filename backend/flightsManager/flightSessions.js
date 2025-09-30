const { log } = require('../utils/logger');
const { config } = require('../config'); // config globale

/**
 * Ajoute ou met à jour un vol dans l'historique en fonction du timeout et du type.
 * Si session live proche trouvée, fusionne les données en conservant le created_time le plus ancien.
 * Tronque la trace si trop longue.
 * Sinon, crée une nouvelle entrée avec created_time courant et trace vide.
 * @param {Object} flight : données vol à insérer
 * @param {Array} historyFile : tableau modifiable des vols dans le fichier cache
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  const now = Date.now();

  const INACTIVE_TIMEOUT = config.backend.inactiveTimeoutMs;
  const MAX_TRACE_LENGTH = config.backend.maxTraceLength;

  // Recherche toutes les sessions du même drone id
  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  let idxToUpdate = -1;
  let selectedCreatedTime = flight.created_time;

  // Cherche session live existante dans le délai INACTIVE_TIMEOUT
  for (let i = 0; i < candidateSessions.length; i++) {
    const session = candidateSessions[i];
    const sessionCreated = new Date(session.created_time).getTime();
    const incomingCreated = new Date(flight.created_time).getTime();

    const timeDiff = Math.abs(incomingCreated - sessionCreated);

    if (timeDiff <= INACTIVE_TIMEOUT && session.type === 'live') {
      if (sessionCreated < new Date(selectedCreatedTime).getTime()) {
        selectedCreatedTime = session.created_time;
      }
      idxToUpdate = historyFile.findIndex(
        f => f.id === flight.id && f.created_time === session.created_time
      );
      break;
    }
  }

  if (idxToUpdate !== -1) {
    // Tronquer la trace si trop longue (garder derniers points)
    let newTrace = Array.isArray(flight.trace) ? flight.trace.slice() : [];
    if (newTrace.length > MAX_TRACE_LENGTH) {
      newTrace = newTrace.slice(newTrace.length - MAX_TRACE_LENGTH);
    }

    log(`[addOrUpdateFlightInFile] Trace length before update: ${newTrace.length}`);

    // Fusion et mise à jour de la session existante
    const updatedFlight = {
      ...historyFile[idxToUpdate],
      ...flight,
      trace: newTrace,
      created_time: selectedCreatedTime,
    };

    historyFile[idxToUpdate] = updatedFlight;

    log(
      `[addOrUpdateFlightInFile] Fusion avec session drone ${flight.id} created_time ${selectedCreatedTime}`
    );
    return;
  }

  // Aucune session live proche, création nouvelle session dans l'historique
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;

  // Ne pas forcer trace vide ici, garder potentiellement celle passée
  if (!flight.trace) {
    flight.trace = [];
  }

  historyFile.push(flight);

  log(`[addOrUpdateFlightInFile] Nouvelle session drone ${flight.id} created_time ${newCreated}, trace length: ${flight.trace.length}`);
}

module.exports = { addOrUpdateFlightInFile };
