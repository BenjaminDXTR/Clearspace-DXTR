import { config } from "../config";

export type LatLng = [number, number];
export type LatLngTimestamp = [number, number, number];

export interface Flight {
  trace?: LatLngTimestamp[] | LatLng[] | string;
  id?: string;
  [key: string]: any;
}

const DEBUG = config.debug || config.environment === "development";

function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

export function isLatLng(val: unknown): val is LatLng {
  return (
    Array.isArray(val) &&
    val.length === 2 &&
    typeof val[0] === "number" &&
    typeof val[1] === "number"
  );
}

export function isLatLngTimestamp(val: unknown): val is LatLngTimestamp {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    typeof val[0] === "number" &&
    typeof val[1] === "number" &&
    typeof val[2] === "number"
  );
}

export function isLatLngOrTimestamp(val: unknown): val is LatLng | LatLngTimestamp {
  return isLatLng(val) || isLatLngTimestamp(val);
}

export function parseTracePoints(pointsStr: string): LatLngTimestamp[] {
  try {
    const parsed = JSON.parse(pointsStr);
    if (Array.isArray(parsed) && parsed.every(isLatLngOrTimestamp)) {
      return parsed as LatLngTimestamp[];
    }
  } catch (error) {
    if (DEBUG) console.error("[parseTracePoints] Erreur parsing JSON trace", error);
  }
  return [];
}

/**
 * Renvoie la trace timestamp ou classique
 */
export function getFlightTrace(flight?: Flight | null): LatLngTimestamp[] {
  if (!flight) {
    dlog("[getFlightTrace] Vol null/undefined");
    return [];
  }

  if (Array.isArray(flight.trace) && flight.trace.every(isLatLngOrTimestamp)) {
    const validPoints = flight.trace.filter(isLatLngOrTimestamp);
    if (validPoints.length !== flight.trace.length) {
      dlog("[getFlightTrace] Certains points de trace sont invalides et seront ignorés");
    }
    return validPoints as LatLngTimestamp[];
  }

  if (typeof flight.trace === "string") {
    return parseTracePoints(flight.trace);
  }

  dlog("[getFlightTrace] Aucune trace valide trouvée");
  return [];
}

/**
 * Extrait lat/lng classique d’une trace timestamp pour affichage map
 */
export function stripTimestampFromTrace(trace: LatLngTimestamp[]): LatLng[] {
  if (!Array.isArray(trace)) {
    dlog("[stripTimestampFromTrace] Trace invalide non tableau");
    return [];
  }

  const cleanTrace = trace.filter(
    (pt): pt is LatLngTimestamp =>
      Array.isArray(pt) &&
      pt.length === 3 &&
      pt.every((v) => typeof v === "number")
  );

  if (cleanTrace.length !== trace.length) {
    dlog(`[stripTimestampFromTrace] Points invalides filtrés: ${trace.length - cleanTrace.length}`);
  }

  return cleanTrace.map(([lat, lng]) => [lat, lng]);
}

/**
 * Calcule la distance haversine entre deux points GPS (en mètres)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
