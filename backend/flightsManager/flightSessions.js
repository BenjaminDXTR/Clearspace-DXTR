const log = require('../utils/logger');
const { config } = require('../config');

/**
 * Ajoute ou met à jour une session de vol dans un fichier historique.
 * Respecte les règles :
 * - crée nouvelle session si vol revient alors qu’une session locale existe pour ce vol
 * - met à jour la même session si vol en live (même id et created_time) ou venant de waiting
 * - fusionne les traces sans dupliquer, conserve le created_time originel
 * - préserve la 3e valeur des points (temps relatif) en ajoutant uniquement les nouveaux points
 * @param {Object} flight - vol détecté
 * @param {Array} historyFile - sessions historiques chargées en mémoire
 */
function addOrUpdateFlightInFile(flight, historyFile) {
  // Trouver toutes les sessions existantes pour ce vol
  const candidateSessions = historyFile.filter(f => f.id === flight.id);

  if (candidateSessions.length > 0) {
    // Trouver session en waiting (prioritaire) ou session live existante
    let sessionToUpdate = candidateSessions.find(s => s.state === 'waiting');
    if (!sessionToUpdate) {
      sessionToUpdate = candidateSessions.find(s => s.state === 'live');
    }

    if (sessionToUpdate) {
      // Si session en local, et vol pas live => pas de mise à jour (nouvelle session créée ailleurs)
      if (sessionToUpdate.state === 'local' && flight.state !== 'live') {
        log.info(`[addOrUpdateFlightInFile] Ignored update for drone ${flight.id}, session in local and vol not live`);
        return;
      }

      // Recherche indice dans historique
      const idxToUpdate = historyFile.findIndex(
        f => f.id === sessionToUpdate.id && f.created_time === sessionToUpdate.created_time
      );
      const existing = historyFile[idxToUpdate];
      const existingTrace = Array.isArray(existing.trace) ? existing.trace : [];
      const newTrace = Array.isArray(flight.trace) ? flight.trace : [];

      // Fusionner traces sans duplication, en conservant les timestamps relatifs (3e valeur)
      const mergedTrace = [...existingTrace];
      for (const pt of newTrace) {
        const exists = mergedTrace.some(p =>
          p[0] === pt[0] && p[1] === pt[1] && p[2] === pt[2]
        );
        if (!exists) {
          mergedTrace.push(pt);
        }
      }
      mergedTrace.sort((a,b) => a[2] - b[2]);

      historyFile[idxToUpdate] = {
        ...existing,
        ...flight,
        trace: mergedTrace,
        created_time: sessionToUpdate.created_time,  // conserve created_time originel
        state: flight.state === 'live' ? 'live' : flight.state, // forcer live si reprise
      };

      log.debug(`[addOrUpdateFlightInFile] Trace length before update: ${newTrace.length} for drone ${flight.id}`);
      log.info(`[addOrUpdateFlightInFile] Updated session for drone ${flight.id} with created_time ${sessionToUpdate.created_time} and merged trace length ${mergedTrace.length}`);

      return;
    }
  }

  // Nouvelle session (vol nouveau ou ancien local réapparu)
  const newCreated = new Date().toISOString();
  flight.created_time = newCreated;
  if (!flight.trace) flight.trace = [];

  historyFile.push(flight);

  log.info(`[addOrUpdateFlightInFile] Added new session for drone ${flight.id} with created_time ${newCreated} and trace length ${flight.trace.length}`);
}

module.exports = { addOrUpdateFlightInFile };
