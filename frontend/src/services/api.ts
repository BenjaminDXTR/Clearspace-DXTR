import { config } from "../config";
import type { Flight } from "../types/models";

const HISTORY_URL = config.apiUrl + "/history";
const ANCHOR_URL = config.apiUrl + "/anchor";
const DEBUG = config.debug || config.environment === "development";

function dlog(...args: any) {
  if (DEBUG) {
    console.log(...args);
  }
}

function handleApiError(context: string, error: unknown, onUserError?: (msg: string) => void): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[API ERROR][${context}]`, error);
  if (onUserError) onUserError(`Erreur API (${context}) : ${message}`);
  throw new Error(`Erreur API (${context}) : ${message}`);
}

export async function fetchLiveDrones(): Promise<Flight[]> {
  dlog("[fetchLiveDrones] Use WebSocket instead");
  return [];
}

export async function fetchLocalHistory(options?: RequestInit, onUserError?: (msg: string) => void): Promise<Flight[]> {
  try {
    const res = await fetch(HISTORY_URL, options);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    handleApiError("fetchLocalHistory", err, onUserError);
  }
}

export async function postLocalHistoryFlight(flight: Flight, onUserError?: (msg: string) => void): Promise<void> {
  try {
    const res = await fetch(HISTORY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flight),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    handleApiError("postLocalHistoryFlight", err, onUserError);
  }
}

export async function fetchAnchoredFlights(onUserError?: (msg: string) => void): Promise<Flight[]> {
  // deprecated or placeholder  
  return [];
}

// Deprecated: Disable actual server sending until backend ready
/*
export async function postAnchorFileName(fileName: string, onUserError?: (msg: string) => void): Promise<void> {
  try {
    const res = await fetch(config.apiUrl + "/anchor/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: fileName }),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    handleApiError("postAnchorFileName", err, onUserError);
  }
}
*/
