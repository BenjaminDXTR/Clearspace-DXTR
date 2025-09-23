/**
 * Configuration centralisée frontend,
 * récupère les variables via import.meta.env (Vite).
 */
export const config = {
  // URL de base de l'API backend à utiliser
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3200",

  // Flag debug (activé si VITE_DEBUG == "true")
  debug: import.meta.env.VITE_DEBUG === "true",

  // Mode d'environnement (ex: "development", "production")
  environment: import.meta.env.MODE || "development",

  // Nombre maximum d'éléments dans l'historique local
  maxHistoryLength: Number(import.meta.env.VITE_MAX_HISTORY_LENGTH) || 100,

  // URLs centralisées des icônes utilisées dans l'app
  iconUrls: {
    droneLive: import.meta.env.VITE_ICON_URL_DRONE_LIVE || "https://cdn-icons-png.flaticon.com/512/854/854878.png",
    droneStart: import.meta.env.VITE_ICON_URL_DRONE_START || "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
  },

  // Tailles par défaut des icônes (parser chaîne "X,Y" vers tuple [X, Y])
  defaultIconSize: (import.meta.env.VITE_ICON_SIZE_DEFAULT
    ? import.meta.env.VITE_ICON_SIZE_DEFAULT.split(",").map(x => Number(x)) as [number, number]
    : [36, 36]) as [number, number],

  historyIconSize: (import.meta.env.VITE_ICON_SIZE_HISTORY
    ? import.meta.env.VITE_ICON_SIZE_HISTORY.split(",").map(x => Number(x)) as [number, number]
    : [28, 28]) as [number, number],
};
