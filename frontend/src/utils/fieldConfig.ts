import type { Flight, Event } from "../types/models";

/**
 * Champs d'affichage pour les tables live (drones en temps réel)
 */
export const LIVE_FIELDS: (keyof Flight)[] = [
  "id",
  "name",
  "created_time",
  "lastseen_time",
  "latitude",
  "longitude",
  "altitude",
  "distance",
];

/**
 * Champs affichés pour l'historique des événements API
 */
export const HISTORY_API_FIELDS: (keyof Event)[] = [
  "id",
  "drone_type",
  "created_time",
  "deleted_time",
];

/**
 * Champs détaillés dans le panneau live / historique local
 */
export const LIVE_DETAILS: (keyof Flight)[] = [
  "altitude",
  "attack_bands",
  "attack_type",
  "attacking",
  "attacking_ttl",
  "blacklisted",
  "can_attack",
  "can_ctrl_landing",
  "can_takeover",
  "can_tdoa",
  "can_toa",
  "confirmed",
  "created_time",
  "ctrl_landing",
  "deleted_time",
  "description",
  "direction",
  "directional_attack_state",
  "distance",
  "has_duplicate",
  "has_screenshot",
  "height",
  "id",
  "image",
  "in_ada",
  "initial_location",
  "jamming_conflicts",
  "lastseen",
  "lastseen_time",
  "latitude",
  "link_id",
  "localization",
  "longitude",
  "name",
  "rc_location",
  "screenshot",
  "secret",
  "seen_sensor",
  "speed",
  "state",
  "tdoa_tracking",
  "toa_measuring",
  "tracing",
  "tracking_video",
  "whitelisted",
];

/**
 * Champs détaillés pour les panneaux d'événements historiques
 */
export const EVENT_DETAILS: (keyof Event)[] = [
  "attacked",
  "blacklisted",
  "created_time",
  "deleted_time",
  "drone_type",
  "first_pos",
  "frequence",
  "has_screenshot",
  "id",
  "image",
  "is_false_alarm",
  "last_pos",
  "rc_pos",
  "seen_sensors",
  "sequence",
  "severity",
  "whitelisted",
];
