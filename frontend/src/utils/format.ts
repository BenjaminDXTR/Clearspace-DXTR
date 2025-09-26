import {
  UNITS,
  SEVERITY_LABELS,
  BOOLEAN_LABELS,
  DEFAULT_DATE_LOCALE,
  DEFAULT_DATE_OPTIONS,
} from "./displayConfig";

import { config } from "../config";

/** Flag debug global basé sur config */
const DEBUG = config.debug || config.environment === "development";

/** Log conditionnel */
function dlog(...args: any[]): void {
  if (DEBUG) console.log(...args);
}

/** Stringify sécurisé évitant erreurs sur objets circulaires */
function safeStringify(value: unknown): string {
  const cache = new Set();
  try {
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (cache.has(val)) return "[Circular]";
        cache.add(val);
      }
      return val;
    });
  } catch {
    return String(value);
  }
}

/**
 * Formate une date ISO ou timestamp en string lisible format fr-FR
 */
export function formatDate(dateValue?: string | number | null): string {
  if (
    !dateValue ||
    dateValue === "0001-01-01T00:00:00Z" ||
    dateValue === "1970-01-01T00:00:00Z"
  ) {
    // Suppression du log dans ce cas fréquent et normal
    return "";
  }
  try {
    const date =
      typeof dateValue === "number" || /^\d+$/.test(String(dateValue))
        ? new Date(Number(dateValue))
        : new Date(dateValue);

    if (isNaN(date.getTime())) {
      console.warn("[formatDate] Date invalide :", dateValue);
      return String(dateValue);
    }

    const formatted = date.toLocaleString(
      DEFAULT_DATE_LOCALE,
      DEFAULT_DATE_OPTIONS
    );
    // Suppression du log systématique, gardez-le uniquement si nécessaire
    return formatted;
  } catch (error) {
    console.error("[formatDate] Erreur formatage date:", error);
    return String(dateValue);
  }
}

/**
 * Formate une valeur selon la clé pour un affichage lisible
 */
export function prettyValue(key: string, value: unknown): string {
  // Valeurs nulles ou vides
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  // Booléens
  if (typeof value === "boolean") {
    return value ? BOOLEAN_LABELS.true : BOOLEAN_LABELS.false;
  }

  // Dates (clé contenant "time")
  if (typeof value === "string" && key.toLowerCase().includes("time")) {
    return formatDate(value);
  }

  // Numérique avec unité
  if (UNITS[key]) {
    return `${value} ${UNITS[key]}`;
  }

  // Sévérité
  if (key === "severity") {
    return SEVERITY_LABELS[String(value)] || String(value);
  }

  // Tableaux
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  // Objets géographiques
  if (
    typeof value === "object" &&
    value !== null &&
    "lat" in value &&
    "lng" in value &&
    typeof (value as any).lat === "number" &&
    typeof (value as any).lng === "number"
  ) {
    return `lat: ${(value as any).lat}, lng: ${(value as any).lng}`;
  }

  // Objets génériques
  if (typeof value === "object" && value !== null) {
    return safeStringify(value);
  }

  // Autres valeurs : string/number/...
  return String(value);
}
