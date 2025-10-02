import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import type { Flight } from "../types/models";

interface DronesContextValue {
  drones: Flight[];
  historyFiles: string[];
  fetchHistory: (filename: string) => Promise<Flight[]>;
  error: string | null;
  loading: boolean;
}

const DronesContext = createContext<DronesContextValue | undefined>(undefined);

export const useDrones = (): DronesContextValue => {
  const context = useContext(DronesContext);
  if (!context) throw new Error("useDrones must be used within a DronesProvider");
  return context;
};

interface DronesProviderProps {
  children: ReactNode;
}

export const DronesProvider = ({ children }: DronesProviderProps) => {
  const [drones, setDrones] = useState<Flight[]>([]);
  const [historyFiles, setHistoryFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const lastError = useRef<string | null>(null);
  const lastErrorTime = useRef<number>(0);
  const errorRef = useRef<string | null>(null);

  const websocketUrl = `ws://${window.location.hostname}:3200`;
  const errorThrottleDelay = 5000; // ms
  const reconnectDelay = 2000; // ms

  const setWebSocketError = (msg: string) => {
    const now = Date.now();
    // Des messages adaptés pour l'erreur de connexion réseau
    const friendlyMsg =
      msg.includes("connection failed") || msg.includes("disconnected")
        ? "Impossible de se connecter au backend : assurez-vous que le serveur est lancé et accessible."
        : msg;

    if (
      lastError.current === friendlyMsg &&
      now - lastErrorTime.current < errorThrottleDelay
      ||
      errorRef.current === friendlyMsg
    ) {
      return; // Evite répétition rapide identique
    }
    lastError.current = friendlyMsg;
    lastErrorTime.current = now;
    errorRef.current = friendlyMsg;
    setError(friendlyMsg);
    console.error("[DronesContext] WEBSOCKET ERROR:", friendlyMsg);
  };

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const fetchHistory = async (filename: string): Promise<Flight[]> => {
    if (!filename) {
      const msg = "Missing filename for history";
      if (errorRef.current !== msg) setError(msg);
      console.error("[DronesContext]", msg);
      return [];
    }
    try {
      const res = await fetch(`${window.location.origin}/history/${filename}`);
      if (!res.ok) {
        const msg = `HTTP error ${res.status} on history fetch`;
        if (errorRef.current !== msg) setError(msg);
        console.error("[DronesContext]", msg);
        return [];
      }
      const contentType = res.headers.get("content-type") || '';
      if (!contentType.includes('application/json')) {
        const msg = `Invalid content-type for history: expected JSON but got ${contentType}`;
        if (errorRef.current !== msg) setError(msg);
        console.error("[DronesContext]", msg);
        return [];
      }
      const data = await res.json() as Flight[];
      if (errorRef.current !== null) setError(null);
      console.log(`[DronesContext] Loaded history file with ${data.length} flights`);
      return data;
    } catch (e) {
      const msg = `Failed to load history: ${(e as Error).message}`;
      if (errorRef.current !== msg) setError(msg);
      console.error("[DronesContext]", msg);
      return [];
    }
  };

  const connectWebSocket = () => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)
    ) {
      return; // Déjà connecté ou connexion en cours
    }

    console.log("[DronesContext] Connecting to websocket:", websocketUrl);

    wsRef.current = new WebSocket(websocketUrl);

    wsRef.current.onopen = () => {
      console.log("[DronesContext] WebSocket connected");
      if (errorRef.current !== null) setError(null);
      setLoading(false);
      lastError.current = null;
      lastErrorTime.current = 0;
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setDrones(data);
        } else if (data.type === 'historySummaries') {
          const files = data.data?.map((f: { filename: string }) => f.filename) ?? [];
          setHistoryFiles(files);
          console.log("[DronesContext] Received history files:", files.join(", "));
        }
      } catch {
        setWebSocketError("Error parsing backend data");
      }
    };

    wsRef.current.onerror = () => {
      setWebSocketError("WebSocket connection failed or backend unavailable");
      setLoading(false);
    };

    wsRef.current.onclose = (event) => {
      setLoading(true);
      if ([1006, 1001].includes(event.code)) {
        setWebSocketError("WebSocket disconnected, reconnecting...");
      }

      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = window.setTimeout(() => {
        connectWebSocket();
      }, reconnectDelay);

      console.log(`[DronesContext] WebSocket disconnected, reconnecting after ${reconnectDelay} ms`);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <DronesContext.Provider value={{ drones, historyFiles, fetchHistory, error, loading }}>
      {children}
    </DronesContext.Provider>
  );
};
