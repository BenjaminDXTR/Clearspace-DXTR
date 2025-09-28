import { config } from '../config';

/**
 * 🌐 URL racine de l'API DroneWeb
 * Récupérée depuis config.ts pour multi‑environnements.
 */
export const API_BASE_URL: string = config.apiUrl;

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
export function logConstantsAccess(debug = config.debug): void {
  if (debug) {
    console.log(
      `[${new Date().toISOString()}] Constants imported from base URL: ${API_BASE_URL}`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Constantes utilisées par App.tsx et TablesLayout.tsx                       */
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
