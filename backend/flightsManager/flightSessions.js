const log = require('../utils/logger');
const { config } = require('../config');

function addOrUpdateFlightInFile(flight, historyFile) {
  const now = Date.now();

  const INACTIVE_TIMEOUT = config.backend.inactiveTimeoutMs;
  const MAX_TRACE_LENGTH = config.backend.maxTraceLength;

  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  let idxToUpdate = -1;
  let selectedCreatedTime = flight.created_time;

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
    let newTrace = Array.isArray(flight.trace) ? flight.trace.slice() : [];
    if (newTrace.length > MAX_TRACE_LENGTH) {
      newTrace = newTrace.slice(newTrace.length - MAX_TRACE_LENGTH);
      log.info(`[addOrUpdateFlightInFile] Trace truncated to max length ${MAX_TRACE_LENGTH} for drone ${flight.id}`);
    }

    log.debug(`[addOrUpdateFlightInFile] Trace length before update: ${newTrace.length}`);

    const updatedFlight = {
      ...historyFile[idxToUpdate],
      ...flight,
      trace: newTrace,
      created_time: selectedCreatedTime,
    };

    historyFile[idxToUpdate] = updatedFlight;

    log.info(`[addOrUpdateFlightInFile] Updated session for drone ${flight.id} with created_time ${selectedCreatedTime}`);
    return;
  }

  // Nouvelle session
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;

  if (!flight.trace) {
    flight.trace = [];
  }

  historyFile.push(flight);

  log.info(`[addOrUpdateFlightInFile] Added new session for drone ${flight.id} with created_time ${newCreated} and trace length ${flight.trace.length}`);
}

module.exports = { addOrUpdateFlightInFile };
