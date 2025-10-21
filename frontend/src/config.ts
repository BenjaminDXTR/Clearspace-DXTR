export const config = {
  // URL de base de l'API backend, construite dynamiquement à partir de l'hôte et du port backend
  apiUrl: (() => {
    const port = Number(import.meta.env.VITE_BACKEND_PORT) || 3200;
    const host =
      window?.location?.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
        ? window.location.hostname
        : 'localhost';
    const protocol = window?.location?.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${host}:${port}`;
  })(),

  debug: import.meta.env.VITE_DEBUG === 'true',
  environment: import.meta.env.MODE ?? 'development',
  maxHistoryLength: Number(import.meta.env.VITE_MAX_HISTORY_LENGTH) || 100,
  inactiveTimeout: Number(import.meta.env.VITE_INACTIVE_TIMEOUT) || 10000,
  websocketPort: Number(import.meta.env.VITE_BACKEND_PORT) || 3200,
  
  websocketUrl: (() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = Number(import.meta.env.VITE_BACKEND_PORT) || 3200;
    return `${protocol}//${host}:${port}`;
  })(),

  iconUrls: {
    droneLive:
      import.meta.env.VITE_ICON_URL_DRONE_LIVE ??
      'https://cdn-icons-png.flaticon.com/512/854/854878.png',
    droneStart:
      import.meta.env.VITE_ICON_URL_DRONE_START ??
      'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  },

  defaultIconSize: import.meta.env.VITE_ICON_SIZE_DEFAULT
    ? (import.meta.env.VITE_ICON_SIZE_DEFAULT.split(',').map((x) => Number(x)) as [number, number])
    : [36, 36],

  historyIconSize: import.meta.env.VITE_ICON_SIZE_HISTORY
    ? (import.meta.env.VITE_ICON_SIZE_HISTORY.split(',').map((x) => Number(x)) as [number, number])
    : [28, 28],
};
