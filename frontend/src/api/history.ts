import type { Flight } from "../types/models";

const baseApiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3200";

export async function fetchHistoryFile(filename: string): Promise<Flight[]> {
  if (!filename) {
    throw new Error("Nom fichier manquant");
  }
  const url = `${baseApiUrl}/history/${filename}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Erreur chargement historique, status=${response.status}`);
  }
  const ct = response.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const bodyText = await response.text();
    throw new Error(
      `Type contenu invalide : attendu JSON, reçu ${ct} ; réponse: ${bodyText.slice(
        0,
        200
      )}`
    );
  }
  const json = await response.json();
  return json as Flight[];
}
