import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';

interface DronesContextValue {
  drones: Flight[]; // Vols live
  historyFiles: string[]; // Liste fichiers historiques (noms)
  fetchHistoryFile: (filename: string) => Promise<Flight[]>;
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);
  const [historyFiles, setHistoryFiles] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);
  const websocketUrl = "ws://localhost:3200";

  const fetchHistoryFile = useCallback(async (filename: string): Promise<Flight[]> => {
    try {
      const response = await fetch(`http://localhost:3200/history/${filename}`);
      if (!response.ok) throw new Error(`Erreur fetch historique: ${response.statusText}`);
      const data = await response.json();
      console.log(`[DronesProvider] Fichier historique chargé: ${filename}, vols: ${data.length}`);
      return data;
    } catch (err) {
      console.error('[DronesProvider] fetchHistoryFile error:', err);
      setError('Erreur chargement historique');
      return [];
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    console.log('[DronesProvider] Tentative connexion WS à', websocketUrl);
    wsRef.current = new WebSocket(websocketUrl);

    wsRef.current.onopen = () => {
      console.log('[DronesProvider] WS connecté');
      setError(null);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (Array.isArray(parsed)) {
          // Message tableau = drones live
          setDrones(parsed);
        } else if (parsed.type === 'historySummaries') {
          // Liste fichiers historique reçue
          const files = parsed.data.map((f: { filename: string }) => f.filename);
          setHistoryFiles(files);
          console.log(`[DronesProvider] Résumé historique reçu: ${files.length} fichiers`);
        } else if (parsed.type === 'historyUpdate') {
          // Notification fichier modifié - rafraichir liste
          const updatedFile = parsed.filename;
          setHistoryFiles(current => {
            if (!current.includes(updatedFile)) {
              console.log(`[DronesProvider] Nouveau fichier historique détecté: ${updatedFile}`);
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
          console.warn('[DronesProvider] Message WS inconnu:', parsed);
        }
      } catch (e) {
        console.error('[DronesProvider] Erreur parse message WS', e);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('[DronesProvider] WS erreur', err);
      setError('WebSocket error');
    };

    wsRef.current.onclose = (event) => {
      console.warn(`[DronesProvider] WS fermé, reconnexion dans 3s, raison: ${event.reason ?? 'inconnue'}`);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = window.setTimeout(() => connectWebSocket(), 3000);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  return (
    <DronesContext.Provider value={{ drones, historyFiles, fetchHistoryFile, error }}>
      {children}
    </DronesContext.Provider>
  );
};
