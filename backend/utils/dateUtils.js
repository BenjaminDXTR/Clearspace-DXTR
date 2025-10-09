/**
 * Applique un décalage horaire en heures à une date ISO et renvoie une date ISO corrigée.
 * @param {string} isoTimestamp Date ISO à corriger
 * @param {number} offsetHours Décalage en heures (+ ou -)
 * @returns {string} Date ISO corrigée
 */
function applyTimeOffset(isoTimestamp, offsetHours) {
    const date = new Date(isoTimestamp);
    date.setHours(date.getHours() + offsetHours);
    return date.toISOString();
}

module.exports = { applyTimeOffset };
