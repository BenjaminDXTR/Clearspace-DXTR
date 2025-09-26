// src/contexts/DronesContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';
import { config } from '../config';

interface DronesContextValue {
  drones: Flight[];
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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  const connectWebSocket = useCallback(() => {
    console.log('[DronesProvider] Tentative connexion WS à', config.websocketUrl);
    wsRef.current = new WebSocket(config.websocketUrl);

    wsRef.current.onopen = () => {
      console.log('[DronesProvider] WS connecté');
      setError(null);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data: Flight[] = JSON.parse(event.data);
        console.log('[DronesProvider] Message reçu, nombre drones:', data.length);
        // Eventuellement log certains drones clés pour vérification
        if (data.length > 0) {
          console.log(`[DronesProvider] Premier drone reçu: id=${data[0].id}, lat=${data[0].latitude}, lon=${data[0].longitude}`);
        }
        setDrones(data);
      } catch (e) {
        console.error('[DronesProvider] Erreur parse message WS', e);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('[DronesProvider] WS erreur', err);
      setError('WebSocket error');
    };

    wsRef.current.onclose = (event) => {
      console.warn(`[DronesProvider] WS fermé, reconnexion dans 3s, raison: ${event.reason}`);
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

  useEffect(() => {
    console.log(`[DronesProvider] État drones mis à jour, compte: ${drones.length}`);
  }, [drones]);

  return (
    <DronesContext.Provider value={{ drones, error }}>
      {children}
    </DronesContext.Provider>
  );
};
