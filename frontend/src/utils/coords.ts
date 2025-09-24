import { DEFAULT_MAX_GEO_DISTANCE_METERS } from "./constants";
import { config } from "../config";  // Import config centralisée

/**
 * Type représentant un point géographique [latitude, longitude].
 */
export type LatLng = [number, number];

/**
 * Type simplifié d'un Flight (vol)
 */
export interface Flight {
  trace?: LatLng[] | string;
  tracing?: { 
    points?: LatLng[]; 
    origin?: { lat: number; lng: number } 
  };
  initial_location?: { lat: number; lng: number };
  id?: string;
  [key: string]: any;
}

/**
 * Type minimal d’un événement
 */
export interface Event {
  id: string;
  latitude?: number;
  longitude?: number;
  [key: string]: any;
}

/** Flag debug global */
const DEBUG = config.debug || config.environment === "development";

/** Log conditionnel */
function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

/** Vérifie si une valeur est un LatLng valide */
export function isLatLng(val: unknown): val is LatLng {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    typeof val[0] === "number" &&
    typeof val[1] === "number"
  );
}

/**
 * Parse une chaîne JSON représentant une trace [lat, lng][]
 */
export function parseTracePoints(pointsStr: string): LatLng[] {
  if (typeof pointsStr !== "string") {
    if (DEBUG) console.warn("[parseTracePoints] Argument non string");
    return [];
  }
  try {
    const parsed = JSON.parse(pointsStr);
    if (Array.isArray(parsed) && parsed.every(isLatLng)) {
      dlog("[parseTracePoints] Trace parsée avec succès");
      return parsed as LatLng[];
    }
  } catch (error) {
    console.error("[parseTracePoints] Erreur parsing JSON", error);
  }
  return [];
}

/**
 * Récupère la trace d’un vol depuis flight.trace, tracing.points,
 * ou en fallback depuis initial_location ou tracing.origin
 */
export function getFlightTrace(flight?: Flight | null): LatLng[] {
  if (!flight) {
    if (DEBUG) console.warn("[getFlightTrace] Vol null/undefined");
    return [];
  }

  // Tableau direct
  if (Array.isArray(flight.trace) && flight.trace.every(isLatLng)) {
    dlog("[getFlightTrace] Trace fournie directement");
    if (flight.trace.length >= 2) {
      return flight.trace as LatLng[];
    }
    // Si trace trop courte, essayez fallback origin ou duplicata
  }

  // String JSON
  if (typeof flight.trace === "string") {
    const parsed = parseTracePoints(flight.trace);
    if (parsed.length >= 2) return parsed;
    // Sinon fallback
  }

  // Tracing.points (validation + non vide)
  const tracingPoints = flight.tracing?.points;
  if (
    Array.isArray(tracingPoints) &&
    tracingPoints.every(isLatLng) &&
    tracingPoints.length >= 2
  ) {
    dlog("[getFlightTrace] Fallback sur tracing.points");
    return tracingPoints as LatLng[];
  }

  // Si trace trop courte, fallback sur initial_location ou origin origin
  let fallbackPoint: LatLng | null = null;
  if (
    flight.initial_location &&
    isLatLng([flight.initial_location.lat, flight.initial_location.lng]) &&
    flight.initial_location.lat !== 0 &&
    flight.initial_location.lng !== 0
  ) {
    fallbackPoint = [flight.initial_location.lat, flight.initial_location.lng];
    dlog("[getFlightTrace] Fallback sur initial_location");
  } else if (
    flight.tracing?.origin &&
    isLatLng([flight.tracing.origin.lat, flight.tracing.origin.lng]) &&
    flight.tracing.origin.lat !== 0 &&
    flight.tracing.origin.lng !== 0
  ) {
    fallbackPoint = [flight.tracing.origin.lat, flight.tracing.origin.lng];
    dlog("[getFlightTrace] Fallback sur tracing.origin");
  }

  if (fallbackPoint) {
    // Pour que Leaflet dessine la ligne, créez un second point très proche
    const offsetPoint: LatLng = [fallbackPoint[0] + 0.00001, fallbackPoint[1] + 0.00001];
    const trace = [fallbackPoint, offsetPoint];
    dlog("[getFlightTrace] Doublage du point fallback pour polyline", trace);
    return trace;
  }

  if (DEBUG) console.warn("[getFlightTrace] Aucune trace valide trouvée");
  return [];
}

/**
 * Calcule la distance entre deux points (Haversine)
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Rayon Terre en mètres
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Trouve une trace qui correspond à un Event (par ID ou proximité géo)
 */
export function findMatchingTrace(
  traces: Flight[],
  event: Event,
  maxDistanceMeters = DEFAULT_MAX_GEO_DISTANCE_METERS
): Flight | undefined {
  if (!Array.isArray(traces)) {
    if (DEBUG) console.warn("[findMatchingTrace] traces invalide");
    return undefined;
  }
  if (!event?.id) {
    if (DEBUG) console.warn("[findMatchingTrace] Event sans ID");
    return undefined;
  }

  // Par ID
  const byId = traces.find(t => t.id === event.id);
  if (byId) {
    dlog(`[findMatchingTrace] Correspondance trouvée par ID (${event.id})`);
    return byId;
  }

  // Par proximité géographique
  if (typeof event.latitude === "number" && typeof event.longitude === "number") {
    for (const trace of traces) {
      const points = getFlightTrace(trace);
      if (!points.length) continue;
      const [lat, lon] = points[0];
      const dist = haversineDistance(lat, lon, event.latitude, event.longitude);
      if (dist <= maxDistanceMeters) {
        dlog(`[findMatchingTrace] Correspondance géo : ${dist.toFixed(1)}m <= ${maxDistanceMeters}m`);
        return trace;
      }
    }
  }

  if (DEBUG) console.log("[findMatchingTrace] Aucune correspondance trouvée");
  return undefined;
}
