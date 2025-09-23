export const config = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3200",
  debug: import.meta.env.VITE_DEBUG === "true",
  environment: import.meta.env.MODE || "development",
  maxHistoryLength: Number(import.meta.env.VITE_MAX_HISTORY_LENGTH) || 100,
  iconUrls: {
    droneLive: import.meta.env.VITE_ICON_URL_DRONE_LIVE || "https://cdn-icons-png.flaticon.com/512/854/854878.png",
    droneStart: import.meta.env.VITE_ICON_URL_DRONE_START || "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
  },
  defaultIconSize: import.meta.env.VITE_ICON_SIZE_DEFAULT ? import.meta.env.VITE_ICON_SIZE_DEFAULT.split(",").map(x => Number(x)) as [number, number] : [36, 36],
  historyIconSize: import.meta.env.VITE_ICON_SIZE_HISTORY ? import.meta.env.VITE_ICON_SIZE_HISTORY.split(",").map(x => Number(x)) as [number, number] : [28, 28],
};
