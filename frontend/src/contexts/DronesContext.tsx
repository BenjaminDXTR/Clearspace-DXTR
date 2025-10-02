import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';
import { fetchHistoryFile } from '../api/history';

interface DronesContextValue {
  drones: Flight[];
  historyFiles: string[];
  fetchHistory: (filename: string) => Promise<Flight[]>;
  error: string | null;
  loading: boolean;
  refreshFilename: string | null;  // Va contenir le nom du fichier modifié, utilisé pour rechargement
}

const DronesContext = createContext<DronesContextValue | undefined>(undefined);

export const useDrones = (): DronesContextValue => {
  const ctx = useContext(DronesContext);
  if (!ctx) throw new Error('useDrones must be used within a DronesProvider');
  return ctx;
};

export const DronesProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [drones, setDrones] = useState<Flight[]>([]);
  const [historyFiles, setHistoryFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshFilename, setRefreshFilename] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const lastError = useRef<{ msg: string; time: number } | null>(null);
  const errorThrottle = 5000;

  const WS_STATES = {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  };

  const websocketUrl = `ws://${window.location.hostname}:3200`;

  function setWebsocketError(msg: string) {
    const now = Date.now();
    if (lastError.current && lastError.current.msg === msg && now - lastError.current.time < errorThrottle) {
      return;
    }
    lastError.current = { msg, time: now };
    setError(msg);
    console.error("[DronesContext] ", msg);
  }

  function connect() {
    if (ws.current && (ws.current.readyState === WS_STATES.CONNECTING || ws.current.readyState === WS_STATES.OPEN)) {
      return;
    }
    if (ws.current && ws.current.readyState === WS_STATES.CLOSING) {
      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          connect();
        }, 2000);
      }
      return;
    }

    ws.current = new WebSocket(websocketUrl);

    ws.current.onopen = () => {
      setError(null);
      setLoading(false);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      console.log("[DronesContext] WebSocket connected");
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[DronesContext] WS message received:", data);

        if (Array.isArray(data)) {
          if (data.length > 0) {
            setDrones(data);
            console.log(`[DronesContext] Drones updated, count: ${data.length}`);
          }
          return;
        }

        if (data && typeof data === "object" && "type" in data) {
          switch (data.type) {
            case "historySummaries":
              if (Array.isArray(data.data)) {
                console.log("[DronesContext] historySummaries data:", data.data);
                const files = data.data.map((item: { filename: string }) => item.filename);
                setHistoryFiles(files);
                console.log("[DronesContext] Updated historyFiles:", files);
              } else {
                console.warn("[DronesContext] Invalid historySummaries data");
              }
              break;
            case "refresh":
              if (data.data?.filename) {
                setRefreshFilename(data.data.filename);
                console.log("[DronesContext] Refresh notification for file:", data.data.filename);
              } else {
                console.warn("[DronesContext] Refresh notification without filename");
              }
              break;
            default:
              console.warn("[DronesContext] Unhandled WS message type:", data.type);
          }
        }
      } catch (e) {
        setWebsocketError("Error parsing WS message");
      }
    };

    ws.current.onerror = (evt) => {
      setWebsocketError("WebSocket error occurred");
      setLoading(true);
      console.error("[DronesContext] WebSocket error:", evt);
    };

    ws.current.onclose = (evt) => {
      setLoading(true);
      const msg = evt.code === 1000
        ? "WebSocket closed normally"
        : `WebSocket disconnected (code: ${evt.code}), reconnecting...`;
      setWebsocketError(msg);
      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          connect();
        }, 2000);
      }
      console.warn("[DronesContext]", msg);
    };
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      if (ws.current) {
        ws.current.onopen = null;
        ws.current.onmessage = null;
        ws.current.onerror = null;
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, []);

  return (
    <DronesContext.Provider
      value={{
        drones,
        historyFiles,
        fetchHistory: fetchHistoryFile,
        error,
        loading,
        refreshFilename,
      }}
    >
      {children}
    </DronesContext.Provider>
  );
};
