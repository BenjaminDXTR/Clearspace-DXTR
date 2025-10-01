import { config } from "../config";
import type { Flight } from "../types/models";

const HISTORY_URL = config.apiUrl + "/history";
const ANCHOR_URL = config.apiUrl + "/anchor";
const DEBUG = config.debug || config.environment === "development";

function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

function handleApiError(context: string, error: unknown, onUserError?: (msg: string) => void): never {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[API ERROR][${context}]`, error);
  if (onUserError) {
    onUserError(`Erreur API (${context}) : ${message}`);
  }
  throw new Error(`Erreur API (${context}) : ${message}`);
}

export async function fetchLiveDrones(): Promise<Flight[]> {
  dlog("[fetchLiveDrones] Utilisez le WebSocket pour récupérer les drones en live");
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

export async function fetchAnchoredFlights(options?: RequestInit, onUserError?: (msg: string) => void): Promise<Flight[]> {
  try {
    const anchorUrl = ANCHOR_URL.replace("/anchor", "/anchored");
    const res = await fetch(anchorUrl, options);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    handleApiError("fetchAnchoredFlights", err, onUserError);
  }
}

export async function postAnchorData(anchorData: any, zipBlob: Blob, onUserError?: (msg: string) => void): Promise<void> {
  try {
    const formData = new FormData();
    formData.append("anchorData", JSON.stringify(anchorData));
    formData.append("proofZip", zipBlob, "anchor.zip");

    const res = await fetch(ANCHOR_URL, { method: "POST", body: formData });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    handleApiError("postAnchorData", err, onUserError);
  }
}
