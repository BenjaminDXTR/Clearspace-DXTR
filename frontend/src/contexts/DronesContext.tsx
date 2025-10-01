// src/contexts/DronesContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';

interface DronesContextValue {
  drones: Flight[];           // Liste des drones live brute, non transformée
  historyFiles: string[];     // Liste des noms des fichiers historiques disponibles
  fetchHistory: (filename: string) => Promise<Flight[]>;  // Charger historique JSON
  error: string | null;       // Erreur globale (lors du WebSocket ou fetch)
  loading: boolean;           // État chargement WebSocket en cours
}

const DronesContext = createContext<DronesContextValue | undefined>(undefined);

export const useDrones = (): DronesContextValue => {
  const context = useContext(DronesContext);
  if (!context)
    throw new Error('useDrones must be used within a DronesProvider');
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

  // Construction URL websocket (à adapter si besoin)
  const websocketUrl = `ws://${window.location.hostname}:3200`;

  // Fonction fetch de l'historique JSON par nom de fichier
  const fetchHistory = async (filename: string): Promise<Flight[]> => {
    if (!filename) {
      const msg = 'Filename is missing for fetching history';
      setError(msg);
      return [];
    }
    try {
      const res = await fetch(`${window.origin}/history/${filename}`);
      if (!res.ok) {
        const msg = `HTTP error ${res.status} while fetching history file`;
        setError(msg);
        return [];
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const msg = `Invalid content type: expected JSON but got ${contentType}`;
        setError(msg);
        return [];
      }
      const data: Flight[] = await res.json();
      setError(null);
      return data;
    } catch (err) {
      const msg = `Error loading history: ${(err as Error).message}`;
      setError(msg);
      return [];
    }
  };

  // Connexion websocket et gestion événements
  const connectWebSocket = () => {
    wsRef.current = new WebSocket(websocketUrl);

    wsRef.current.onopen = () => {
      setError(null);
      setLoading(false);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
          setDrones(data);
        } else if (data.type === 'historySummaries') {
          const files: string[] = data.data?.map((f: { filename: string }) => f.filename) ?? [];
          setHistoryFiles(files);
        }
        // Ignorer autres types de messages
      } catch {
        // Ignore parse erreurs
      }
    };

    wsRef.current.onerror = () => {
      setError('WebSocket error');
      setLoading(false);
    };

    wsRef.current.onclose = () => {
      setLoading(true);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = window.setTimeout(connectWebSocket, 2000);
    };
  };

  // Effet démarrant la connexion websocket au montage
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
