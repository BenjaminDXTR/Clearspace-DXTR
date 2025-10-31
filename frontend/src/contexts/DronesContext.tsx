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

const PING_INTERVAL = 20000; // Ping toutes les 20s
const PONG_TIMEOUT = 10000;  // Timeout pong 10s
const RECONNECT_DELAY = 2000; // Reconnexion toutes les 2s

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

  // Dernière erreur et timestamp pour throttling
  const lastError = useRef<{ msg: string; time: number } | null>(null);
  const errorThrottle = 5000; // 5 secondes mini entre même erreur

  const websocketUrl = config.websocketUrl;

  // Fonction pour nettoyer timers ping/pong & éviter fuites mémoire
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

  // Fonction transformant messages techniques en messages utilisateur
  function getFriendlyMessage(rawMsg: string): string {
    if (!rawMsg) return '';

    if (rawMsg.includes('Failed to fetch')) {
      return 'Connexion au serveur backend impossible, vérifiez votre réseau ou que le serveur est démarré.';
    }
    if (rawMsg.includes('WebSocket connection')) {
      return 'Problème de connexion WebSocket avec le serveur.';
    }
    if (rawMsg.includes('Pong non reçu')) {
      return 'Connexion instable au serveur, tentative de reconnexion en cours...';
    }
    // Autres cas personnalisés ici

    return rawMsg;
  }

  // Met à jour l’erreur affichée avec throttling (ne pas spammer la même erreur)
  function setWebsocketError(msg: string) {
    const now = Date.now();

    if (
      lastError.current &&
      lastError.current.msg === msg &&
      now - lastError.current.time < errorThrottle
    ) {
      return; // Ignore répétition trop rapide
    }

    lastError.current = { msg, time: now };

    const friendlyMsg = getFriendlyMessage(msg);
    setError((prev) => (prev === friendlyMsg ? prev : `Erreur de connexion au serveur : ${friendlyMsg}`));
    console.error(`[${new Date().toISOString()}][DronesContext] ${msg}`);
  }

  // Supprime l’erreur de connexion si elle n’est plus actuelle (ex: connexion établie)
  function clearConnectionError() {
    setError((prev) => {
      if (prev && prev.startsWith('Erreur de connexion au serveur')) {
        return null;
      }
      return prev;
    });
  }

  // Envoi d’un ping WS et attente pong sinon fermeture
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

  // Schedule pings périodiques
  function schedulePing() {
    clearTimeouts();
    pingTimeout.current = setTimeout(() => {
      sendPing();
      schedulePing();
    }, PING_INTERVAL);
  }

  // Connexion WS avec reconnexion automatique
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

    ws.current = new WebSocket(websocketUrl);

    // Timeout connexion WS (écoute échec rapide)
    const connectionTimeout = setTimeout(() => {
      if (ws.current && ws.current.readyState !== WS_STATES.OPEN) {
        setWebsocketError('Le serveur backend semble inaccessible ou non démarré.');
        setLoading('disconnected');
        ws.current.close();
      }
    }, 3000);

    // Gestion ouverture WS
    ws.current.onopen = () => {
      clearTimeout(connectionTimeout);
      setLoading('connected');
      console.log(`[${new Date().toISOString()}][DronesContext] WS connection established`);

      // Nettoie erreur connexion WS après 1s
      setTimeout(() => {
        clearConnectionError();
      }, 1000);

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      schedulePing();
    };

    // Gestion messages WS
    ws.current.onmessage = (event) => {
      clearTimeout(pongTimeout.current!);

      try {
        const data = JSON.parse(event.data);

        // Cas tableau de drones (mise à jour)
        if (Array.isArray(data)) {
          const enriched = data.map((drone) => {
            if (drone.state === 'waiting' && !drone.trace) {
              return { ...drone, trace: [] };
            }
            return drone;
          });

          setDrones(enriched);

          console.log(`[DronesContext] Received ${enriched.length} drones, including ${enriched.filter(f => f.state === 'waiting').length} waiting`);

          return;
        }

        // Cas message structuré websocket
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

    // Gestion erreur WS
    ws.current.onerror = (evt) => {
      clearTimeout(connectionTimeout);
      setWebsocketError('Erreur réseau lors de la connexion WebSocket');
      setLoading('disconnected');
    };

    // Gestion fermeture WS
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
