import { MAX_HISTORY_LENGTH } from "../utils/constants";
import { config } from "../config";

const LOCAL_STORAGE_KEY = "droneweb_history";
const DEBUG = config.debug || config.environment === "development";

export interface Flight {
  id: string;
  created_time: string;
  [key: string]: unknown;
}

function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

function warnUser(message: string, onUserError?: (msg: string) => void) {
  if (onUserError) onUserError(message);
}

export function isFlight(f: unknown): f is Flight {
  return (
    typeof f === "object" &&
    f !== null &&
    typeof (f as any).id === "string" &&
    typeof (f as any).created_time === "string"
  );
}

export function getLocalHistory(onUserError?: (msg: string) => void): Flight[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      dlog("[getLocalHistory] No history found");
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      const warning = "[getLocalHistory] Invalid data (not an array)";
      console.warn(warning);
      warnUser(warning, onUserError);
      return [];
    }
    const flights = parsed.filter(isFlight);
    dlog(`[getLocalHistory] Found ${flights.length} valid flights`);
    return flights;
  } catch (error) {
    const errMsg = `[getLocalHistory] Parsing error: ${(error as Error).message}`;
    console.error(errMsg);
    warnUser(errMsg, onUserError);
    return [];
  }
}

export function addToLocalHistory(flight: Flight, onUserError?: (msg: string) => void): void {
  if (!isFlight(flight)) {
    const warning = "[addToLocalHistory] Invalid flight object";
    console.warn(warning, flight);
    warnUser(warning, onUserError);
    return;
  }
  try {
    let history = getLocalHistory(onUserError);
    if (history.some(f => f.id === flight.id && f.created_time === flight.created_time)) {
      dlog("[addToLocalHistory] Flight already present, skipping");
      return;
    }
    history = [flight, ...history].slice(0, MAX_HISTORY_LENGTH);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
    dlog(`[addToLocalHistory] Added flight id=${flight.id}`);
  } catch (error) {
    const errMsg = `[addToLocalHistory] Error adding flight: ${(error as Error).message}`;
    console.error(errMsg);
    warnUser(errMsg, onUserError);
  }
}

export function removeFromLocalHistory(id: string, created_time: string, onUserError?: (msg: string) => void): void {
  if (!id || !created_time) {
    const warning = "[removeFromLocalHistory] Missing id or created_time";
    console.warn(warning);
    warnUser(warning, onUserError);
    return;
  }
  try {
    const filtered = getLocalHistory(onUserError).filter(f => !(f.id === id && f.created_time === created_time));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    dlog(`[removeFromLocalHistory] Removed flight id=${id}`);
  } catch (error) {
    const errMsg = `[removeFromLocalHistory] Error removing flight: ${(error as Error).message}`;
    console.error(errMsg);
    warnUser(errMsg, onUserError);
  }
}

export function clearLocalHistory(onUserError?: (msg: string) => void): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    dlog("[clearLocalHistory] Cleared local history");
  } catch (error) {
    const errMsg = `[clearLocalHistory] Error clearing history: ${(error as Error).message}`;
    console.error(errMsg);
    warnUser(errMsg, onUserError);
  }
}
