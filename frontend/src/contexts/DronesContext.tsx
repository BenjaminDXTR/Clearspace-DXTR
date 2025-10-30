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

const PING_INTERVAL = 20000; // Intervalle ping toutes les 20s
const PONG_TIMEOUT = 10000;  // Timeout pong 10s
const RECONNECT_DELAY = 2000; // Reconnexion WS toutes les 2s

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
  const errorThrottle = 5000; // Minimum 5s entre mêmes messages d’erreur

  const websocketUrl = config.websocketUrl;

  // Nettoyer timers ping/pong pour éviter fuites mémoire
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

  // Envoi ping régulièrement et attente pong sinon ferme WS
  function sendPing() {
    if (!ws.current || ws.current.readyState !== WS_STATES.OPEN) return;
    try {
      ws.current.send(JSON.stringify({ type: 'ping' }));
      console.log(`[DronesContext][${new Date().toISOString()}] Ping envoyé`);
      pongTimeout.current = setTimeout(() => {
        console.warn(`[DronesContext][${new Date().toISOString()}] Pong non reçu, fermeture WS`);
        ws.current?.close();
      }, PONG_TIMEOUT);
    } catch (err) {
      console.error(`[DronesContext][${new Date().toISOString()}] Erreur en envoyant ping:`, err);
    }
  }

  // Planifie les pings pour maintenir connexion
  function schedulePing() {
    clearTimeouts();
    pingTimeout.current = setTimeout(() => {
      sendPing();
      schedulePing();
    }, PING_INTERVAL);
  }

  // Met à jour l’erreur avec throttling pour éviter rafraîchissements incessants
  function setWebsocketError(msg: string) {
    const now = Date.now();
    if (
      lastError.current &&
      lastError.current.msg === msg &&
      now - lastError.current.time < errorThrottle
    ) {
      return; // Message identique récent, ignore la mise à jour
    }
    lastError.current = { msg, time: now };
    setError((prev) => (prev === msg ? prev : `Erreur de connexion au serveur : ${msg}`));
    console.error(`[${new Date().toISOString()}][DronesContext] ${msg}`);
  }

  // Connexion WS avec reconnexion automatique et gestion d’erreurs rapides
  function connect() {
    if (ws.current && [WS_STATES.OPEN, WS_STATES.CONNECTING].includes(ws.current.readyState)) {
      console.log(`[${new Date().toISOString()}][DronesContext] WS déjà connecté ou en connexion`);
      return;
    }
    if (ws.current) {
      try {
        console.log(`[${new Date().toISOString()}][DronesContext] Fermeture WS existant avant nouvelle connexion`);
        ws.current.close();
      } catch (e) {
        console.warn(`[${new Date().toISOString()}][DronesContext] Erreur en fermant WS:`, e);
      }
      ws.current = null;
    }
    if (reconnectTimeout.current) {
      console.log(`[${new Date().toISOString()}][DronesContext] Reconnexion déjà programmée, ignorée`);
      return;
    }

    console.log(`[${new Date().toISOString()}][DronesContext] Nouvelle tentative de connexion WS à ${websocketUrl}`);
    setLoading('connecting');
    // Ne nettoie pas l’erreur ici, pour garder visible message si existant

    ws.current = new WebSocket(websocketUrl);

    // Timeout pour échec rapide en cas de backend inaccessible
    const connectionTimeout = setTimeout(() => {
      if (ws.current && ws.current.readyState !== WS_STATES.OPEN) {
        setWebsocketError('Le serveur backend semble inaccessible ou non démarré.');
        setLoading('disconnected');
        ws.current.close();
      }
    }, 3000);

    ws.current.onopen = () => {
      clearTimeout(connectionTimeout);
      setLoading('connected');
      console.log(`[${new Date().toISOString()}][DronesContext] WS connection established`);

      /*
       * Nettoie l’erreur uniquement si elle concerne la connexion WS,
       * après 1s de stabilité pour éviter disparition/retour rapide du message
       */
      setTimeout(() => {
        setError((prev) => {
          if (prev && prev.startsWith('Erreur de connexion au serveur')) {
            return null;
          }
          return prev;
        });
      }, 1000);

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      schedulePing();
    };

    ws.current.onmessage = (event) => {
      clearTimeout(pongTimeout.current!);
      try {
        const data = JSON.parse(event.data);

        // Si c'est un tableau, on enrichit la donnée avant la mise à jour
        if (Array.isArray(data)) {
          // Parcours des drones reçus 
          // On s'assure qu'un drone "waiting" a bien une propriété trace
          const enriched = data.map((drone) => {
            if (drone.state === 'waiting' && !drone.trace) {
              // Ajout d'une trace vide si absent
              return { ...drone, trace: [] };
            }
            return drone;
          });

          setDrones(enriched);

          // On peut logger pour debug
          console.log(`[DronesContext] Received ${enriched.length} drones, including ${enriched.filter(f => f.state === 'waiting').length} waiting`);

          return;
        }

        // Gestion des messages spécifiques autres que tableau
        if (data && typeof data === 'object' && 'type' in data) {
          switch (data.type) {
            case 'ping':
              if (ws.current?.readyState === WS_STATES.OPEN) {
                ws.current.send(JSON.stringify({ type: 'pong' }));
              }
              break;
            case 'pong':
              if (pongTimeout.current) {
                clearTimeout(pongTimeout.current);
                pongTimeout.current = null;
              }
              break;
            case 'historySummaries':
              if (Array.isArray(data.data)) {
                const files = data.data.map((item: { filename: string }) => item.filename);
                setHistoryFiles(files);
              }
              break;
            case 'refresh':
              if (data.data?.filename) {
                setRefreshFilename(data.data.filename);
              }
              break;
            default:
              setError(`Message WS inconnu ou mal formé : ${JSON.stringify(data)}`);
              break;
          }
        }
      } catch (e) {
        setWebsocketError(`Erreur parsing message WS : ${(e as Error).message}`);
      }
    };


    ws.current.onerror = (evt) => {
      clearTimeout(connectionTimeout);
      setWebsocketError('Erreur réseau lors de la connexion WebSocket');
      setLoading('disconnected');
    };

    ws.current.onclose = (evt) => {
      clearTimeout(connectionTimeout);
      setLoading('disconnected');
      const msg =
        evt.code === 1000
          ? 'WS fermé normalement'
          : `WS déconnecté (code=${evt.code}, raison=${evt.reason}), reconnexion...`;
      setWebsocketError(msg);

      const userFriendly = evt.code === 1000
        ? 'Connexion fermée correctement.'
        : `Connexion interrompue (${evt.code}). Tentative de reconnexion...`;
      setError(userFriendly);

      if (!reconnectTimeout.current) {
        reconnectTimeout.current = setTimeout(() => {
          reconnectTimeout.current = null;
          connect();
        }, RECONNECT_DELAY);
      }
      clearTimeouts();
    };
  }

  // Démarrage initial du WS + nettoyage au démontage
  useEffect(() => {
    const startupDelay = 1000;
    const timeoutId = setTimeout(() => connect(), startupDelay);

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

  // Récupération contrôlée du fichier historique à rafraîchir seulement si connecté
  useEffect(() => {
    if (loading !== 'connected') {
      console.log(`[DronesContext] Abandon récupération historique, WS déconnecté`);
      return;
    }
    if (!refreshFilename) return;

    let ignore = false;
    const fetchAndClear = async () => {
      try {
        console.log(`[DronesContext] Chargement historique ${refreshFilename}`);
        await fetchHistoryFile(refreshFilename);
      } catch (err) {
        console.error(`[DronesContext] Erreur chargement historique ${refreshFilename} :`, err);
      } finally {
        if (!ignore) setRefreshFilename(null); // évite boucle infinie
      }
    };
    fetchAndClear();

    return () => {
      ignore = true;
    };
  }, [refreshFilename, loading]);

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
