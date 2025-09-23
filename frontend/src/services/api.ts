import { fetchGraphQL, DRONETRACES_GRAPHQL } from "../utils/graphql";
import { config } from "../config";
import type { Flight, Event } from "../types/models";

const GRAPHQL_URL = config.apiUrl + "/graphql";
const HISTORY_URL = config.apiUrl + "/history";
const ANCHOR_URL = config.apiUrl + "/anchor";
const DEBUG = config.debug || config.environment === "development";

/** Log conditionnel */
function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

/** Formate et propage une erreur API */
function handleApiError(context: string, error: unknown): never {
  console.error(`[API ERROR][${context}]`, error);
  if (error instanceof Error) {
    throw new Error(`Erreur API (${context}) : ${error.message}`);
  }
  throw new Error(`Erreur API (${context})`);
}

/**
 * Récupère les drones en direct depuis GraphQL (proxy backend)
 * @param options options fetch (ex: { signal })
 */
export async function fetchLiveDrones(options?: RequestInit): Promise<Flight[]> {
  const query = `
  {
    drone {
      altitude attack_bands attack_type attacking attacking_ttl blacklisted
      can_attack can_ctrl_landing can_takeover can_tdoa can_toa confirmed
      created_time ctrl_landing deleted_time description direction
      directional_attack_state distance has_duplicate has_screenshot height
      id image in_ada
      initial_location { lat lng }
      jamming_conflicts lastseen lastseen_time latitude link_id
      localization { lat lng }
      longitude name rc_location { lat lng }
      screenshot secret
      seen_sensor { bandwidth_khz detected_freq_khz port snr_dB noise_dbm sensor_id signal_dbm }
      speed state tdoa_tracking toa_measuring
      tracing { origin { lat lng } points lastlen }
      tracking_video whitelisted
    }
  }`;
  try {
    dlog("[fetchLiveDrones] Query:", query);
    const data = await fetchGraphQL<{ data: { drone: Flight[] } }>(query, GRAPHQL_URL, options);
    return data.data?.drone || [];
  } catch (err) {
    handleApiError("fetchLiveDrones", err);
  }
}

/**
 * Récupère l’historique distant d’événements
 */
export async function fetchHistoricEvents(options?: RequestInit): Promise<Event[]> {
  const query = `
  {
    events_by_paging(order_by: "created_time", limit: 50, order: "desc") {
      data {
        attacked blacklisted created_time deleted_time drone_type
        first_pos frequence has_screenshot id image is_false_alarm
        last_pos rc_pos seen_sensors sequence severity whitelisted
      }
    }
  }`;
  try {
    dlog("[fetchHistoricEvents] Query:", query);
    const data = await fetchGraphQL<{ data: { events_by_paging: { data: Event[] } } }>(
      query,
      GRAPHQL_URL,
      options
    );
    return data.data?.events_by_paging?.data || [];
  } catch (err) {
    handleApiError("fetchHistoricEvents", err);
  }
}

/**
 * Récupère les traces d’un ou plusieurs drones entre deux timestamps
 */
export async function fetchDroneTraces(
  from: number | string,
  to: number | string,
  options?: RequestInit
): Promise<any[]> {
  const query = DRONETRACES_GRAPHQL(from, to);
  try {
    dlog("[fetchDroneTraces] Query:", query);
    const data = await fetchGraphQL<{ data: { dronetraces: any[] } }>(
      query,
      GRAPHQL_URL,
      options
    );
    return data.data?.dronetraces || [];
  } catch (err) {
    handleApiError("fetchDroneTraces", err);
  }
}

/**
 * Charge l’historique local des vols stocké par le backend
 */
export async function fetchLocalHistory(options?: RequestInit): Promise<Flight[]> {
  try {
    const res = await fetch(HISTORY_URL, options);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    handleApiError("fetchLocalHistory", err);
  }
}

/**
 * Ajoute un vol à l’historique local
 */
export async function postLocalHistoryFlight(flight: Flight): Promise<void> {
  try {
    const res = await fetch(HISTORY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flight)
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    handleApiError("postLocalHistoryFlight", err);
  }
}

/**
 * Récupère la liste des vols ancrés
 */
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

/**
 * Envoie un dossier d’ancrage au backend (métadonnées JSON + ZIP)
 */
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
