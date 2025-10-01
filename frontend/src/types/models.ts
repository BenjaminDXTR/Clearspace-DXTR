import type { ReactNode } from "react";

/**
 * Type représentant un point géographique [latitude, longitude].
 */
export type LatLng = [number, number];

/**
 * Type représentant un point géo avec timestamp relatif
 */
export type LatLngTimestamp = [number, number, number];

/**
 * Flight / vol principal utilisé dans l'app.
 * id est strictement une string.
 * created_time est optionnelle.
 * trace peut être sous forme tableau classique, tableau timestampé ou string json.
 * tracing est optionnel.
 * _type est un champ interne pour indiquer le type d'origine ("live" | "local" | "event").
 */
export interface Flight {
  id: string;
  created_time?: string;
  trace?: LatLng[] | LatLngTimestamp[] | string;
  tracing?: {
    points?: LatLng[];
  };
  _type?: "live" | "local" | "event";
  [key: string]: any;
}

/**
 * Détection (ex: dans TablesLayout ou live drone).
 * Semblable à Flight mais séparé pour une meilleure clarté si besoin.
 * id obligatoire et string.
 */
export interface Detection {
  id: string;
  created_time?: string;
  [key: string]: any;
}

/**
 * Événement historique (ex: distant).
 */
export interface Event {
  id: string;
  sequence?: number;
  latitude?: number;
  longitude?: number;
  created_time?: string;
  [key: string]: any;
}

/**
 * Type pour la fonction vérifiant si un vol est ancré.
 * Doit prendre id (string) et created_time (string) obligatoire.
 */
export type IsAnchoredFn = (id: string, created_time: string) => boolean;

/**
 * Fonction de rendu d'une cellule d'ancrage dans les tables.
 * Reçoit un vol Flight et retourne un ReactNode.
 */
export type RenderAnchorCellFn = (flight: Flight) => ReactNode;

/**
 * Fonction de sélection d'un vol/détection.
 * Reçoit un Flight et ne retourne rien.
 */
export type HandleSelectFn = (flight: Flight) => void;

/**
 * Interface pour la modale ancrage.
 */
export interface AnchorModal {
  flight: Flight;
  [key: string]: any;
}
