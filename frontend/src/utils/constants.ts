/**
 * 🌐 URL racine de l'API DroneWeb
 * Récupérée depuis `.env` pour multi‑environnements.
 * Exemple dans .env :
 *   REACT_APP_API_BASE_URL=http://localhost:3200
 */
export const API_BASE_URL: string =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3200";

/**
 * Endpoints API principaux
 */
export const GRAPHQL_URL: string = `${API_BASE_URL}/graphql`;
export const HISTORY_URL: string = `${API_BASE_URL}/history`;
export const ANCHOR_URL: string = `${API_BASE_URL}/anchor`;

/**
 * Pagination par défaut
 */
export const PER_PAGE = 10 as const;

/**
 * Longueurs maximales / valeurs par défaut côté client
 */
export const MAX_HISTORY_LENGTH = 100 as const; // pour localHistoryService
export const DEFAULT_MAX_GEO_DISTANCE_METERS = 30 as const; // pour recherche proximité coords

/**
 * Trace si l'import de constantes est effectué (activation via paramètre debug)
 */
export function logConstantsAccess(
  debug = process.env.NODE_ENV === "development"
): void {
  if (debug) {
    console.log(
      `[${new Date().toISOString()}] Constants imported from base URL: ${API_BASE_URL}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 🆕 Ajout des constantes attendues par App.tsx                               */
/* -------------------------------------------------------------------------- */

/** Colonnes à afficher pour les drones en direct */
export const LIVE_FIELDS = [
  "id",          // Identifiant unique
  "name",        // Modèle/Nom
  "latitude",
  "longitude",
  "altitude",
  "distance",    // Distance drone
  "speed",
  "created_time"
];


/** Colonnes à afficher pour l'historique API */
export const HISTORY_API_FIELDS = [
  "id",
  "sequence",
  "created_time"
];

/** Champs détaillés pour un vol en direct ou local */
export const LIVE_DETAILS = [
  "id",
  "name",
  "drone_type",         // si dispo dans la réponse
  "created_time",
  "lastseen_time",
  "latitude",
  "longitude",
  "altitude",
  "distance",
  "speed",
  "state",
  "confirmed",
  "description",
  "attack_bands",
  "attack_type",
  "attacking",
  "blacklisted",
  "whitelisted",
  "initial_location",
  "rc_location",
  "localization",
  "reliability",
  "seen_sensor",
  "tracing"
];


/** Champs détaillés pour un événement (provenance API/events) */
export const EVENT_DETAILS = [
  "id",
  "sequence",
  "created_time",
  "points"
];
