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

  const websocketUrl = `ws://${window.location.hostname}:3200`;

  const setWebSocketError = (msg: string) => {
    if (lastError.current === msg) {
      console.log("[DronesContext] Même erreur déjà émise, suppression de la duplication :", msg);
      return;
    }
    lastError.current = msg;
    setError(msg);
    console.error("[DronesContext] ERREUR WEBSOCKET :", msg);
  };

  const fetchHistory = async (filename: string): Promise<Flight[]> => {
    if (!filename) {
      const msg = "Filename is missing for fetching history";
      setError(msg);
      console.error("[DronesContext] Erreur fetchHistory sans filename");
      return [];
    }
    try {
      const res = await fetch(`${window.origin}/history/${filename}`);
      if (!res.ok) {
        const msg = `HTTP error ${res.status} while fetching history file`;
        setError(msg);
        console.error("[DronesContext] " + msg);
        return [];
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const msg = `Invalid content type: expected JSON but got ${contentType}`;
        setError(msg);
        console.error("[DronesContext] " + msg);
        return [];
      }
      const data: Flight[] = await res.json();
      setError(null);
      return data;
    } catch (err) {
      const msg = `Error loading history: ${(err as Error).message}`;
      setError(msg);
      console.error("[DronesContext] " + msg);
      return [];
    }
  };

  const connectWebSocket = () => {
    console.log("[DronesContext] Tentative de connexion WebSocket à", websocketUrl);
    wsRef.current = new WebSocket(websocketUrl);

    wsRef.current.onopen = () => {
      console.log("[DronesContext] WebSocket connectée");
      setError(null);
      setLoading(false);
      lastError.current = null;
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setDrones(data);
          console.log(`[DronesContext] Données drones reçues, count: ${data.length}`);
        } else if (data.type === "historySummaries") {
          const files = data.data?.map((f: { filename: string }) => f.filename) ?? [];
          setHistoryFiles(files);
          console.log(`[DronesContext] Fichiers historiques reçus: ${files.join(", ")}`);
        }
      } catch {
        setWebSocketError("Erreur lors du traitement des données reçues du backend.");
      }
    };

    wsRef.current.onerror = () => {
      setWebSocketError(
        "Connexion WebSocket impossible : le backend n'est pas lancé ou la connexion réseau a échoué."
      );
      setLoading(false);
    };

    wsRef.current.onclose = (event) => {
      setLoading(true);
      if (event.code === 1006 || event.code === 1001) {
        setWebSocketError(
          "Connexion WebSocket impossible : le backend n'est pas lancé ou la connexion réseau a échoué."
        );
      }
      console.log("[DronesContext] WebSocket fermée, reconnexion dans 2 secondes...");
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = window.setTimeout(connectWebSocket, 2000);
    };
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, []);

  return (
    <DronesContext.Provider value={{ drones, historyFiles, fetchHistory, error, loading }}>
      {children}
    </DronesContext.Provider>
  );
};
