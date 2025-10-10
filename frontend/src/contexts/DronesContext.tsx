import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { Flight } from '../types/models';
import { fetchHistoryFile } from '../api/history';
import { config } from '../config';

interface DronesContextValue {
  drones: Flight[];
  historyFiles: string[];
  fetchHistory: (filename: string) => Promise<Flight[]>;
  error: string | null;
  loading: 'connecting' | 'connected' | 'disconnected';
  refreshFilename: string | null;
}

const DronesContext = createContext<DronesContextValue | undefined>(undefined);

export const useDrones = (): DronesContextValue => {
  const ctx = useContext(DronesContext);
  if (!ctx) throw new Error('useDrones must be used within a DronesProvider');
  return ctx;
};

const WS_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
};

const PING_INTERVAL = 20000; // 20 secondes
const PONG_TIMEOUT = 10000; // 10 secondes
const RECONNECT_DELAY = 2000; // délai fixe 2 secondes

export const DronesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [drones, setDrones] = useState<Flight[]>([]);
  const [historyFiles, setHistoryFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [refreshFilename, setRefreshFilename] = useState<string | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const pingTimeout = useRef<NodeJS.Timeout | null>(null);
  const pongTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastError = useRef<{ msg: string; time: number } | null>(null);
  const errorThrottle = 5000;

  const websocketUrl = config.websocketUrl;


  function clearTimeouts() {
    if (pingTimeout.current) {
      clearTimeout(pingTimeout.current);
      pingTimeout.current = null;
    }
    if (pongTimeout.current) {
      clearTimeout(pongTimeout.current);
      pongTimeout.current = null;
    }
  }

  function sendPing() {
    if (!ws.current || ws.current.readyState !== WS_STATES.OPEN) {
      return;
    }
    try {
      ws.current.send(JSON.stringify({ type: 'ping' }));
      console.log(`[DronesContext][${new Date().toISOString()}] Ping sent`);
      pongTimeout.current = setTimeout(() => {
        console.warn(`[DronesContext][${new Date().toISOString()}] Pong not received in time, closing connection`);
        ws.current?.close();
      }, PONG_TIMEOUT);
    } catch (err) {
      console.error(`[DronesContext][${new Date().toISOString()}] Error sending ping:`, err);
    }
  }

  function schedulePing() {
    clearTimeouts();
    pingTimeout.current = setTimeout(() => {
      sendPing();
      schedulePing();
    }, PING_INTERVAL);
  }

  function setWebsocketError(msg: string) {
    const now = Date.now();
    if (lastError.current && lastError.current.msg === msg && now - lastError.current.time < errorThrottle) {
      return;
    }
    lastError.current = { msg, time: now };
    setError(`Erreur de connexion au serveur: ${msg}`);
    console.error(`[${new Date().toISOString()}][DronesContext] ${msg}`);
  }


  function connect() {
    if (ws.current) {
      if (ws.current.readyState === WS_STATES.OPEN || ws.current.readyState === WS_STATES.CONNECTING) {
        console.log(`[${new Date().toISOString()}][DronesContext] WS already connecting or open, skipping connect`);
        return;
      }
      try {
        console.log(`[${new Date().toISOString()}][DronesContext] Closing existing WS connection before new connect`);
        ws.current.close();
      } catch (e) {
        console.warn(`[${new Date().toISOString()}][DronesContext] Error while closing WS:`, e);
      }
      ws.current = null;
    }
    if (reconnectTimeout.current) {
      console.log(`[${new Date().toISOString()}][DronesContext] Reconnect already scheduled, ignoring new connect call`);
      return;
    }
    console.log(`[${new Date().toISOString()}][DronesContext] Attempting WS connection to ${websocketUrl}`
  );


    setLoading('connecting');
    console.log(`[DronesContext][${new Date().toISOString()}] Opening WS connection to ${websocketUrl}`);

    ws.current = new WebSocket(websocketUrl);

    ws.current.onopen = () => {
      setError(null);
      setLoading('connected');
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      console.log(`[${new Date().toISOString()}][DronesContext] WS connection established`);
      schedulePing();
    };

    ws.current.onmessage = (event) => {
      clearTimeout(pongTimeout.current!);
      try {
        const data = JSON.parse(event.data);
        console.log(`[DronesContext][${new Date().toISOString()}] WS message received:`, data);

        if (Array.isArray(data)) {
            setDrones(data);
            console.log(`[DronesContext][${new Date().toISOString()}] Drones updated, count: ${data.length}`);
          return;
        }

        if (data && typeof data === 'object' && 'type' in data) {
          switch (data.type) {
            case 'ping':
              if (ws.current?.readyState === WS_STATES.OPEN) {
                ws.current.send(JSON.stringify({ type: 'pong' }));
                console.log(`[DronesContext][${new Date().toISOString()}] Pong sent`);
              }
              break;
            case 'pong':
              console.log(`[DronesContext][${new Date().toISOString()}] Pong received`);
              if (pongTimeout.current) {
                clearTimeout(pongTimeout.current);
                pongTimeout.current = null;
              }
              break;
            case 'historySummaries':
              if (Array.isArray(data.data)) {
                console.log(`[DronesContext][${new Date().toISOString()}] historySummaries data:`, data.data);
                const files = data.data.map((item: { filename: string }) => item.filename);
                setHistoryFiles(files);
                console.log(`[DronesContext][${new Date().toISOString()}] Updated historyFiles:`, files);
              } else {
                console.warn(`[DronesContext][${new Date().toISOString()}] Invalid historySummaries data:`, data.data);
              }
              break;
            case 'refresh':
              if (data.data?.filename) {
                setRefreshFilename(data.data.filename);
                console.log(`[DronesContext][${new Date().toISOString()}] Notification refresh reçue pour fichier: ${data.data.filename}`);
              } else {
                console.warn(`[DronesContext][${new Date().toISOString()}] Refresh notification received without filename`);
              }
              break;
            default:
              const unknownMsg = `Message WebSocket inconnu ou mal formé: ${JSON.stringify(data)}`;
              setError(unknownMsg);
              console.warn(`[${new Date().toISOString()}][DronesContext] ${unknownMsg}`);
              break;
          }
        }
      } catch (e) {
        setWebsocketError(`Error parsing WS message: ${(e as Error).message}`);
      }
    };

    ws.current.onerror = (evt) => {
      const errorMsg = 'Erreur réseau lors de la connexion WebSocket';
      setWebsocketError(errorMsg);
      setLoading('disconnected');
      console.error(`[${new Date().toISOString()}][DronesContext] WS network error:`, evt);
    };

    ws.current.onclose = (evt) => {
      setLoading('disconnected');
      const msg =
        evt.code === 1000
          ? 'WebSocket closed normally'
          : `WebSocket disconnected, code=${evt.code}, reason=${evt.reason}, reconnecting...`;
      setWebsocketError(msg);
      const disconnectMsg = evt.code === 1000 ? 'Normal WS close' : `Abnormal WS close with code ${evt.code}`;
      console.warn(`[${new Date().toISOString()}][DronesContext] WS disconnected: ${disconnectMsg}, schedule reconnect`);
      const userFriendlyMsg = evt.code === 1000 ? 
        'Connexion au serveur fermée correctement.' :
        `La connexion au serveur a été interrompue (${evt.code}). Tentative de reconnexion en cours...`;
      setError(userFriendlyMsg);
      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          connect();
        }, RECONNECT_DELAY);
      }
      console.warn(`[DronesContext][${new Date().toISOString()}] ${msg}`);
      clearTimeouts();
    };
  }

  useEffect(() => {
    const startupDelay = 1000; // délai 1s pour laisser la page se stabiliser

    const timeoutId = setTimeout(() => {
      connect();
    }, startupDelay);

    return () => {
      clearTimeout(timeoutId);
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      clearTimeouts();
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
