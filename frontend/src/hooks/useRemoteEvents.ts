import { useState, useEffect, useMemo } from "react";
import type { Event } from "../types/models";
import { PER_PAGE } from "../utils/constants";

interface UseRemoteEventsOptions {
  debug?: boolean;
}

export default function useRemoteEvents({
  debug = false,
}: UseRemoteEventsOptions = {}) {
  const [remoteEvents, setRemoteEvents] = useState<Event[]>([]);
  const [traces, setTraces] = useState<Event[]>([]);
  const [apiPage, setApiPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Correction : forcer port websocket backend (3200)
    // const wsUrl = (window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.host;
    const wsPort = import.meta.env.VITE_WEBSOCKET_PORT || "3200";
    const wsUrl = (window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.hostname + ":" + wsPort;

    dlog("[useRemoteEvents] Connexion WS à URL :", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      dlog("[useRemoteEvents] WebSocket connecté");
      setLoading(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        dlog("[useRemoteEvents] Message WS reçu :", data);

        if (Array.isArray(data)) {
          setRemoteEvents(data);
          setTraces([]);
        }
      } catch (e) {
        setError("Erreur parsing message WS : " + (e as Error).message);
      }
    };

    ws.onerror = (event) => {
      dlog("[useRemoteEvents] Erreur WS", event);
      setError("Erreur WebSocket");
    };

    ws.onclose = () => {
      dlog("[useRemoteEvents] WebSocket fermé");
    };

    return () => {
      ws.close();
    };
  }, [debug]);

  const apiMaxPage = useMemo(() => Math.max(1, Math.ceil(remoteEvents.length / PER_PAGE)), [remoteEvents]);

  const apiPageData = useMemo(() => remoteEvents.slice((apiPage - 1) * PER_PAGE, apiPage * PER_PAGE), [remoteEvents, apiPage]);

  return {
    remoteEvents,
    traces,
    apiPage,
    setApiPage,
    apiMaxPage,
    apiPageData,
    loading,
    error,
  };
}
