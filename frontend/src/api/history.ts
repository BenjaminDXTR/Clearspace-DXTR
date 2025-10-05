import type { Flight } from "../types/models";

const baseApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3200";

/**
 * Wrapper fetch avec gestion de retry en cas d'erreur réseau.
 * @param url URL à fetcher.
 * @param options Options fetch.
 * @param retries Nombre de tentatives (défaut 3).
 * @param delay Délai entre tentatives en ms (défaut 500ms).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 500
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`[fetchWithRetry] Tentative ${i + 1} échouée pour ${url}, nouvelle tentative dans ${delay} ms`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("Fetch échoué après plusieurs tentatives");
}

export async function fetchHistoryFile(filename: string): Promise<Flight[]> {
  if (!filename) {
    throw new Error("Nom fichier manquant");
  }
  const url = `${baseApiUrl}/history/${filename}`;
  console.log(`[fetchHistoryFile] Fetching URL: ${url}`);

  const response = await fetchWithRetry(url, { cache: "no-store" });
  console.log(`[fetchHistoryFile] Response status: ${response.status}`);
  const ct = response.headers.get("content-type") ?? "";
  console.log(`[fetchHistoryFile] Content-Type: ${ct}`);

  if (!response.ok) {
    throw new Error(`Erreur chargement historique, status=${response.status}`);
  }
  if (!ct.includes("application/json")) {
    const bodyText = await response.text();
    console.error(
      `[fetchHistoryFile] Type contenu invalide : attendu JSON, reçu ${ct} ; réponse: ${bodyText.slice(0, 200)}`
    );
    throw new Error(
      `Type contenu invalide : attendu JSON, reçu ${ct} ; réponse: ${bodyText.slice(0, 200)}`
    );
  }
  const json = await response.json();
  console.log(`[fetchHistoryFile] Parsed ${json.length} flights`, json);
  return json as Flight[];
}

export async function fetchHistoryFlight(filename: string, flightId: string): Promise<Flight> {
  if (!filename || !flightId) {
    throw new Error("Nom fichier ou ID vol manquant");
  }
  const url = `${baseApiUrl}/history/${filename}/${flightId}`;
  console.log(`[fetchHistoryFlight] Fetching URL: ${url}`);

  const response = await fetchWithRetry(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Erreur chargement vol historique, status=${response.status}`);
  }
  const json = await response.json();
  console.log(`[fetchHistoryFlight] Parsed flight with id=${flightId}`, json);
  return json as Flight;
}

