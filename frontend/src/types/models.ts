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
 * Flight / vol principal utilisé dans l'application.
 * L'identifiant `id` est strictement une chaîne de caractères.
 * Le champ `created_time` est optionnel et correspond à la date de création du vol.
 * Le champ `trace` peut contenir le tracé sous forme de tableau de points classiques,
 * tableau avec timestamps relatifs ou une chaîne JSON.
 * Le champ `tracing` est optionnel et stocke des informations supplémentaires sur le tracé.
 * Le champ `state` indique la nature du vol : "live" pour vol en temps réel,
 * "local" pour vol archivé (historique), et "event" pour un événement associé.
 * Le champ `isAnchored` optionnel précise si le vol est ancré dans la blockchain.
 */
export interface Flight {
  id: string;
  created_time?: string;
  trace?: LatLng[] | LatLngTimestamp[] | string;
  tracing?: {
    points?: LatLng[];
  };
  state?: "live" | "local" | "event"; // Utiliser ce champ directement pour différencier les vols
  isAnchored?: boolean;
  [key: string]: any;
}

/**
 * Détection associée, par exemple utilisée dans des tableaux de détections ou vols live.
 * Similaire à Flight mais séparée pour une meilleure clarté.
 * `id` est obligatoire et de type chaîne.
 */
export interface Detection {
  id: string;
  created_time?: string;
  [key: string]: any;
}

/**
 * Événement historique, par exemple pour des événements distants ou autres entités temporelles.
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
 * Type de fonction permettant de vérifier si un vol est ancré dans la blockchain.
 * Elle prend un `id` de vol et son `created_time`, tous deux chaînes, et retourne un booléen.
 */
export type IsAnchoredFn = (id: string, created_time: string) => boolean;

/**
 * Fonction de rendu d’une cellule d’ancrage dans les tableaux.
 * Prend un vol de type Flight et retourne un ReactNode (élément JSX).
 */
export type RenderAnchorCellFn = (flight: Flight) => ReactNode;

/**
 * Fonction de sélection d’un vol ou d’une détection.
 * Reçoit un objet Flight et ne retourne rien.
 */
export type HandleSelectFn = (flight: Flight) => void;

/**
 * Interface décrivant la modale d’ancrage.
 * Contient un vol Flight et des propriétés additionnelles éventuelles.
 */
export interface AnchorModal {
  flight: Flight;
  [key: string]: any;
}
