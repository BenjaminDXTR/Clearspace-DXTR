const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Ajoute ou met à jour une session vol dans un historique.
 * - Priorité aux sessions en waiting puis live pour mise à jour
 * - Ignore modification si session locale présente et vol non live
 * - Crée nouvelle session pour vol live s'il n'y a pas de session active
 * - Ajoute un point unique par détection avec temps relatif recalculé
 * @param {Object} flight
 * @param {Array} historyFile
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  // Cherche session en waiting (prioritaire)
  let sessionToUpdate = candidateSessions.find(s => s.state === 'waiting');

  // Sinon cherche session live
  if (!sessionToUpdate) {
    sessionToUpdate = candidateSessions.find(s => s.state === 'live');
  }

  // Si pas de session en waiting/live, gère session locale
  if (!sessionToUpdate) {
    const localSession = candidateSessions.find(s => s.state === 'local');

    if (localSession && flight.state !== 'live') {
      log.info(`Ignored update for drone ${flight.id}, session is local and vol not live`);
      return;
    }
    // Vol live avec session locale => création nouvelle session ci-dessous
  }

  if (sessionToUpdate) {
    const idx = historyFile.findIndex(f => f.id === sessionToUpdate.id && f.created_time === sessionToUpdate.created_time);
    const existing = historyFile[idx];
    const existingTrace = Array.isArray(existing.trace) ? existing.trace : [];

    const createdMs = new Date(sessionToUpdate.created_time).getTime();
    const lastSeenMs = new Date(flight.lastseen_time || new Date()).getTime();
    const deltaMs = Math.max(lastSeenMs - createdMs, 0);
    const newPoint = [flight.latitude, flight.longitude, deltaMs];

    const updatedTrace = existingTrace.slice();
    const lastPoint = updatedTrace.length ? updatedTrace[updatedTrace.length - 1] : null;

    if (!lastPoint || lastPoint[0] !== newPoint[0] || lastPoint[1] !== newPoint[1] || lastPoint[2] !== newPoint[2]) {
      updatedTrace.push(newPoint);
    }

    historyFile[idx] = {
      ...existing,
      ...flight,
      trace: updatedTrace,
      created_time: sessionToUpdate.created_time,
      state: flight.state === 'live' ? 'live' : flight.state,
    };

    log.info(`Updated session for drone ${flight.id} with created_time ${sessionToUpdate.created_time}, total points ${updatedTrace.length}`);
    return;
  }

  // Crée une nouvelle session si aucune session active trouvée
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;

  if (!flight.trace || flight.trace.length === 0) {
    flight.trace = [[flight.latitude, flight.longitude, 0]];
  }

  historyFile.push(flight);

  log.info(`Added new session for drone ${flight.id} with created_time ${newCreated}`);
}

module.exports = { addOrUpdateFlightInFile };
