import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';

interface ExtendedFlight extends Flight {
  _type: 'live' | 'local' | 'event';
}

interface DronesContextValue {
  drones: ExtendedFlight[];
  historyFiles: string[];
  fetchHistory: (filename: string, onError?: (msg: string) => void) => Promise<ExtendedFlight[]>;
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
  const [drones, setDrones] = useState<ExtendedFlight[]>([]);
  const [historyFiles, setHistoryFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  const websocketUrl = 'ws://localhost:3200';

  const fetchHistory = useCallback(async (filename: string, onError?: (msg: string) => void): Promise<ExtendedFlight[]> => {
    try {
      if (!filename) {
        const msg = 'Filename is missing for fetching history';
        setError(msg);
        onError?.(msg);
        return [];
      }

      console.log(`[DronesProvider] Loading history file ${filename}`);

      const res = await fetch(`${window.origin}/history/${filename}`);

      if (!res.ok) {
        const msg = `HTTP error ${res.status} while fetching history file`;
        setError(msg);
        onError?.(msg);
        return [];
      }

      // Verify content-type
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const msg = `Invalid content type: expected JSON but got ${contentType}`;
        setError(msg);
        onError?.(msg);
        return [];
      }

      const data: Flight[] = await res.json();

      const mapped: ExtendedFlight[] = data.map(d => ({ ...d, _type: 'local' }));
      setCurrentFile(filename);
      console.log(`[DronesProvider] Loaded ${mapped.length} historical flights`);
      return mapped;
    } catch (err) {
      const msg = `Error loading history: ${(err as Error).message}`;
      console.error(msg);
      setError(msg);
      onError?.(msg);
      return [];
    }
  }, []);

  const mapDronesWithType = (drones: Flight[]): ExtendedFlight[] =>
    drones
      .filter(d => d.id)
      .map(d => ({
        ...d,
        _type: d.type === 'local' ? 'local' : 'live',
      }));

  const connectWebSocket = useCallback(() => {
    wsRef.current = new WebSocket(websocketUrl);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setError(null);
      setLoading(false);
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received', data);

        if (Array.isArray(data)) {
          if (data.length === 0) {
            setDrones([]);
            return;
          }
          const extended = mapDronesWithType(data);
          extended.forEach(d => console.log(`Drone ${d.id} points: ${d.trace?.length ?? 0}`));
          setDrones((oldDrones) => {
            const locals = oldDrones.filter(d => d._type === 'local');
            return [...locals, ...extended.filter(d => d._type === 'live')];
          });
        } else if (data.type === 'historySummaries') {
          const files: string[] = data.data?.map((f: { filename: string }) => f.filename) ?? [];
          setHistoryFiles(files);
          console.log(`Received history summaries`, files);
        } else if (data.type === 'refresh') {
          const updatedFile: string = data.data?.filename ?? '';
          setHistoryFiles((old) => {
            if (!old.includes(updatedFile)) {
              return [...old, updatedFile].sort();
            }
            return old;
          });
          console.log(`Refresh notification for file ${updatedFile}`);

          if (updatedFile === currentFile) {
            const hist = await fetchHistory(updatedFile);
            setDrones((old) => {
              const filtered = old.filter(d => d._type !== 'local');
              return [...filtered, ...hist];
            });
          }
        } else if (data.data?.drone) {
          const dronesData = Array.isArray(data.data.drone) ? data.data.drone : [data.data.drone];
          const liveDrones = mapDronesWithType(dronesData).filter(d => d._type === 'live');
          liveDrones.forEach(d => console.log(`Live drone ${d.id} points: ${d.trace?.length ?? 0}`));
          setDrones((old) => {
            const locals = old.filter(d => d._type === 'local');
            return [...locals, ...liveDrones];
          });
        } else {
          console.warn('Unknown WebSocket message', data);
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    wsRef.current.onerror = (ev) => {
      console.error('WebSocket error', ev);
      setError('WebSocket error');
      setLoading(false);
    };

    wsRef.current.onclose = (ev) => {
      console.warn('WebSocket closed, reconnecting...', ev);
      setLoading(true);
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = window.setTimeout(() => connectWebSocket(), 100);
    };
  }, [websocketUrl, currentFile, fetchHistory]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  return (
    <DronesContext.Provider
      value={{
        drones,
        historyFiles,
        fetchHistory,
        error,
        loading,
      }}
    >
      {children}
    </DronesContext.Provider>
  );
};
