import type { Flight } from "../types/models";

const baseApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3200";

export async function fetchHistoryFile(filename: string): Promise<Flight[]> {
  if (!filename) {
    throw new Error("Nom fichier manquant");
  }
  const url = `${baseApiUrl}/history/${filename}`;
  console.log(`[fetchHistoryFile] Fetching URL: ${url}`);
  const response = await fetch(url, { cache: "no-store" });
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
