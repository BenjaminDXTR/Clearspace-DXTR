/**
 * Unités associées à certains champs
 */
export const UNITS: Record<string, string> = {
  altitude: "m",
  distance: "m",
  speed: "m/s",
};

/**
 * Mapping des niveaux de sévérité
 */
export const SEVERITY_LABELS: Record<string | number, string> = {
  0: "Inconnu",
  1: "Faible",
  2: "Moyenne",
  3: "Élevée",
};

/**
 * Libellés à afficher pour booléens
 */
export const BOOLEAN_LABELS: Record<"true" | "false", string> = {
  true: "Oui",
  false: "Non",
};

/**
 * Format de date par défaut (locale)
 */
export const DEFAULT_DATE_LOCALE = "fr-FR";

/**
 * Options de formatage date standard pour affichage
 */
export const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};
