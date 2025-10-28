const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Ajoute ou met à jour une session vol dans un historique.
 * - Nouvelle session si pas de session en waiting/live avec id donné
 * - Mise à jour session existante en waiting/live sinon
 * - Ne modifie jamais session locale, elle est archivées
 * - Fusionne traces, recalibre timestamps relatifs
 * @param {Object} flight
 * @param {Array} historyFile
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  // Réserver les sessions en waiting ou live (actives)
  const activeSessions = candidateSessions.filter(s => s.state === 'waiting' || s.state === 'live');

  if (activeSessions.length > 0) {
    // Priorise session waiting sinon live la plus ancienne
    let sessionToUpdate = activeSessions.find(s => s.state === 'waiting');
    if (!sessionToUpdate) {
      sessionToUpdate = activeSessions.reduce((oldest, s) =>
        new Date(s.created_time) < new Date(oldest.created_time) ? s : oldest, activeSessions[0]);
    }

    const idx = historyFile.findIndex(f => f.id === sessionToUpdate.id && f.created_time === sessionToUpdate.created_time);
    const existing = historyFile[idx];

    const existingTrace = Array.isArray(existing.trace) ? existing.trace : [];
    const newTrace = Array.isArray(flight.trace) ? flight.trace : [];

    const createdMs = new Date(sessionToUpdate.created_time).getTime();
    const lastSeenMs = new Date(flight.lastseen_time || new Date()).getTime();
    const deltaMs = Math.max(lastSeenMs - createdMs, 0);

    const newPoint = [flight.latitude, flight.longitude, deltaMs];
    let updatedTrace = existingTrace.slice();
    const lastPoint = updatedTrace.length > 0 ? updatedTrace[updatedTrace.length -1] : null;

    // Ajouter le point unique si différent du dernier
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

  // Si PAS de session waiting/live (donc possiblement locale ou aucune),
  // NOUVELLE SESSION systématiquement créée
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;

  // Init trace avec 1 point et temps relatif 0 si vide
  if (!flight.trace || flight.trace.length === 0) {
    flight.trace = [[flight.latitude, flight.longitude, 0]];
  }

  historyFile.push(flight);
  log.info(`Added new session for drone ${flight.id} with created_time ${newCreated}`);
}

module.exports = { addOrUpdateFlightInFile };
