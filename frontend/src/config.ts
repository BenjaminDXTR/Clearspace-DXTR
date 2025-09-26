// src/config.ts
export const config = {
  // URL de base de l'API backend, ou fallback local
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3200",

  // Flag debug frontend activé si variable "true"
  debug: import.meta.env.VITE_DEBUG === "true",

  // Environnement d'exécution ("development", "production", ...)
  environment: import.meta.env.MODE ?? "development",

  // Nombre d’éléments max dans l’historique local
  maxHistoryLength: Number(import.meta.env.VITE_MAX_HISTORY_LENGTH) || 100,

  inactiveTimeout: Number(import.meta.env.VITE_INACTIVE_TIMEOUT) || 10000,

  // Port WebSocket exposé par le backend (ex: 3200)
  websocketPort: Number(import.meta.env.VITE_WEBSOCKET_PORT) || 3200,

  // URL websocket construite dynamiquement côté frontend
  websocketUrl: (() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = Number(import.meta.env.VITE_WEBSOCKET_PORT) || 3200;
    return `${protocol}//${host}:${port}`;
  })(),

  // URLs des icônes (live et start)
  iconUrls: {
    droneLive:
      import.meta.env.VITE_ICON_URL_DRONE_LIVE ??
      "https://cdn-icons-png.flaticon.com/512/854/854878.png",
    droneStart:
      import.meta.env.VITE_ICON_URL_DRONE_START ??
      "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
  },

  // Taille par défaut des icônes, parsing format "W,H"
  defaultIconSize: import.meta.env.VITE_ICON_SIZE_DEFAULT
    ? (import.meta.env.VITE_ICON_SIZE_DEFAULT.split(",").map((x) => Number(x)) as [
        number,
        number
      ])
    : [36, 36],

  // Taille des icônes pour trajectoire historique
  historyIconSize: import.meta.env.VITE_ICON_SIZE_HISTORY
    ? (import.meta.env.VITE_ICON_SIZE_HISTORY.split(",").map((x) => Number(x)) as [
        number,
        number
      ])
    : [28, 28],
};
