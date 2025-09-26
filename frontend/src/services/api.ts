import { config } from "../config";
import type { Flight, Event } from "../types/models";

const HISTORY_URL = config.apiUrl + "/history";
const ANCHOR_URL = config.apiUrl + "/anchor";
const DEBUG = config.debug || config.environment === "development";

function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

function handleApiError(context: string, error: unknown): never {
  console.error(`[API ERROR][${context}]`, error);
  if (error instanceof Error) {
    throw new Error(`Erreur API (${context}) : ${error.message}`);
  }
  throw new Error(`Erreur API (${context})`);
}

// Vous devez désormais récupérer les drones en live via WebSocket
// Cette fonction peut être supprimée ou remplacée par une API locale ou store WebSocket
export async function fetchLiveDrones(): Promise<Flight[]> {
  dlog("[fetchLiveDrones] Utilisez le WebSocket pour récupérer les drones en live");
  // Ici retourner un tableau vide ou lever une erreur si nécessaire
  return [];
}

// Suppression des fonctions fetchHistoricEvents et fetchDroneTraces si elles reposaient sur /graphql

export async function fetchLocalHistory(options?: RequestInit): Promise<Flight[]> {
  try {
    const res = await fetch(HISTORY_URL, options);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    handleApiError("fetchLocalHistory", err);
  }
}

export async function postLocalHistoryFlight(flight: Flight): Promise<void> {
  try {
    const res = await fetch(HISTORY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flight),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    handleApiError("postLocalHistoryFlight", err);
  }
}

export async function fetchAnchoredFlights(options?: RequestInit): Promise<Flight[]> {
  try {
    const anchorUrl = ANCHOR_URL.replace("/anchor", "/anchored");
    const res = await fetch(anchorUrl, options);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    handleApiError("fetchAnchoredFlights", err);
  }
}

export async function postAnchorData(anchorData: any, zipBlob: Blob): Promise<void> {
  try {
    const formData = new FormData();
    formData.append("anchorData", JSON.stringify(anchorData));
    formData.append("proofZip", zipBlob, "anchor.zip");

    const res = await fetch(ANCHOR_URL, { method: "POST", body: formData });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    handleApiError("postAnchorData", err);
  }
}
