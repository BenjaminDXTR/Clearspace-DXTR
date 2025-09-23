import { config } from "./config";

/** URL GraphQL issue de config */
export const GRAPHQL_URL: string = config.apiUrl + "/graphql";

/** Flag debug global */
const DEBUG = config.debug || config.environment === "development";

/** Log conditionnel */
function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

/**
 * Query statique : infos drone en live
 */
export const DRONE_QUERY = `
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
}
`;

/**
 * Query statique : historique événements API
 */
export const EVENT_HISTORY_GRAPHQL = `
{
  events_by_paging(order_by: "created_time", limit: 50, order: "desc") {
    data {
      attacked blacklisted created_time deleted_time drone_type
      first_pos frequence has_screenshot id image is_false_alarm
      last_pos rc_pos seen_sensors sequence severity whitelisted
    }
  }
}
`;

/**
 * Query dynamique : traces de drone entre deux dates
 */
export const DRONETRACES_GRAPHQL = (from: number | string, to: number | string): string => {
  if (from === undefined || to === undefined || from === null || to === null) {
    if (DEBUG) console.warn("[DRONETRACES_GRAPHQL] paramètres 'from' ou 'to' invalides", { from, to });
  }
  const fromStr = typeof from === "number" ? from : JSON.stringify(from);
  const toStr = typeof to === "number" ? to : JSON.stringify(to);
  return `
{
  dronetraces(from: ${fromStr}, to: ${toStr}) {
    id binding_id created_time points
  }
}
`;
};

/**
 * Exécute une requête GraphQL générique et retourne les données typées
 * @param query - Query GraphQL
 * @param url - URL du service GraphQL (par défaut GRAPHQL_URL)
 * @param options - Options fetch supplémentaires (ex: { signal, headers })
 */
export async function fetchGraphQL<T = any>(
  query: string,
  url: string = GRAPHQL_URL,
  options: RequestInit = {}
): Promise<T> {
  try {
    if (DEBUG) dlog("[fetchGraphQL] URL:", url);

    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method: "POST",
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers as Record<string, string> | undefined),
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // ⚠ GraphQL peut renvoyer "errors" même en 200 OK
    if (result.errors) {
      console.error("[fetchGraphQL] Erreurs GraphQL :", result.errors);
      throw new Error(result.errors.map((e: any) => e.message).join("; "));
    }

    return result;
  } catch (error) {
    console.error("[fetchGraphQL] Erreur requête GraphQL", error);
    throw error;
  }
}
