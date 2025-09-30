import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';

interface DronesContextValue {
  drones: Flight[];
  historyFiles: string[];
  fetchHistoryFile: (filename: string) => Promise<Flight[]>;
  error: string | null;
  loading: boolean;
}

const DronesContext = createContext<DronesContextValue | undefined>(undefined);

export const useDrones = (): DronesContextValue => {
  const context = useContext(DronesContext);
  if (!context) {
    throw new Error('useDrones must be used within a DronesProvider');
  }
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
  const websocketUrl = "ws://localhost:3200";

  const fetchHistoryFile = useCallback(async (filename: string): Promise<Flight[]> => {
    try {
      console.log(`[DronesProvider] Chargement fichier historique : ${filename}`);
      const response = await fetch(`http://localhost:3200/history/${filename}`);
      if (!response.ok) throw new Error(`Erreur fetch historique: ${response.statusText}`);
      const data = await response.json();
      console.log(`[DronesProvider] Fichier historique chargé : ${filename}, nombre de vols : ${data.length}`);
      return data;
    } catch (err) {
      console.error('[DronesProvider] fetchHistoryFile error:', err);
      setError('Erreur chargement historique');
      return [];
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    console.log('[DronesProvider] Tentative connexion WebSocket à', websocketUrl);
    wsRef.current = new WebSocket(websocketUrl);

    wsRef.current.onopen = () => {
      console.log('[DronesProvider] WebSocket connecté');
      setError(null);
      setLoading(false);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const rawData = event.data;
        console.log('[DronesProvider] Message WebSocket reçu brut :', rawData);
        const parsed = JSON.parse(rawData);
        console.log('[DronesProvider] Message WebSocket analysé :', parsed);

        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            console.log('[DronesProvider] Tableau de drones vide reçu, suppression des drones live');
            setDrones([]);
          } else {
            const validDrones = parsed.filter(d => d?.id);
            setDrones(validDrones);
          }
        } else if (parsed.type === 'historySummaries') {
          const files = parsed.data.map((f: { filename: string }) => f.filename);
          setHistoryFiles(files);
          console.log(`[DronesProvider] Résumé historique reçu : ${files.length} fichiers`);
        } else if (parsed.type === 'refresh') {
          const updatedFile = parsed.data.filename;
          setHistoryFiles(current => {
            if (!current.includes(updatedFile)) {
              console.log(`[DronesProvider] Nouveau fichier historique détecté : ${updatedFile}`);
              return [...current, updatedFile].sort();
            }
            return current;
          });
          console.log(`[DronesProvider] Notification mise à jour historique : ${updatedFile}`);
        } else if (parsed.data && Array.isArray(parsed.data.drone)) {
          if (parsed.data.drone.length === 0) {
            console.log('[DronesProvider] Réception détection vide - suppression des vols live');
            setDrones([]);
          } else {
            setDrones(parsed.data.drone);
          }
        } else {
          console.warn('[DronesProvider] Message WebSocket inconnu:', parsed);
        }
      } catch (e) {
        console.error('[DronesProvider] Erreur parsing message WebSocket', e);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('[DronesProvider] Erreur WebSocket', err);
      setError('WebSocket error');
      setLoading(false);
    };

    wsRef.current.onclose = (event) => {
      console.warn(`[DronesProvider] WebSocket fermé, reconnexion dans 3s. Raison : ${event.reason ?? 'inconnue'}`);
      setLoading(true);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = window.setTimeout(() => connectWebSocket(), 3000);
    };
  }, [websocketUrl]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  return (
    <DronesContext.Provider value={{ drones, historyFiles, fetchHistoryFile, error, loading }}>
      {children}
    </DronesContext.Provider>
  );
};
