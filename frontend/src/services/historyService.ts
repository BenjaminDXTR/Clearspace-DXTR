import { MAX_HISTORY_LENGTH } from "../utils/constants";

const LOCAL_STORAGE_KEY = "droneweb_history";
const DEBUG = process.env.NODE_ENV === "development";

export interface Flight {
  id: string;
  created_time: string;
  [key: string]: unknown;
}

/** Log conditionnel */
function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

/** Type guard : valide qu'un objet est un Flight */
function isFlight(f: unknown): f is Flight {
  return (
    typeof f === "object" &&
    f !== null &&
    typeof (f as any).id === "string" &&
    typeof (f as any).created_time === "string"
  );
}

/**
 * Lit l'historique depuis le localStorage navigateur
 */
export function getLocalHistory(): Flight[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) {
      dlog("[getLocalHistory] Aucun historique trouvé");
      return [];
    }
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      console.warn("[getLocalHistory] Données invalides (non tableau)");
      return [];
    }
    const flights = parsed.filter(isFlight);
    dlog(`[getLocalHistory] ${flights.length} vol(s) valide(s)`);
    return flights;
  } catch (error) {
    console.error("[getLocalHistory] Erreur de parsing :", error);
    return [];
  }
}

/**
 * Ajoute un vol à l'historique (évite doublons, limite la taille)
 */
export function addToLocalHistory(flight: Flight): void {
  if (!isFlight(flight)) {
    console.warn("[addToLocalHistory] Vol invalide :", flight);
    return;
  }
  try {
    let history = getLocalHistory();
    if (history.some(f => f.id === flight.id && f.created_time === flight.created_time)) {
      dlog("[addToLocalHistory] Vol déjà présent, ignoré");
      return;
    }
    history = [flight, ...history].slice(0, MAX_HISTORY_LENGTH);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(history));
    dlog(`[addToLocalHistory] Vol ajouté id=${flight.id}`);
  } catch (error) {
    console.error("[addToLocalHistory] Erreur lors de l’ajout :", error);
  }
}

/**
 * Supprime un vol par id + created_time
 */
export function removeFromLocalHistory(id: string, created_time: string): void {
  if (!id || !created_time) {
    console.warn("[removeFromLocalHistory] id ou created_time manquant");
    return;
  }
  try {
    const filtered = getLocalHistory().filter(
      f => !(f.id === id && f.created_time === created_time)
    );
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    dlog(`[removeFromLocalHistory] Vol supprimé id=${id}`);
  } catch (error) {
    console.error("[removeFromLocalHistory] Erreur lors de la suppression :", error);
  }
}

/**
 * Vide totalement l'historique local
 */
export function clearLocalHistory(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    dlog("[clearLocalHistory] Historique vidé");
  } catch (error) {
    console.error("[clearLocalHistory] Erreur lors du vidage :", error);
  }
}
