import { useState, useEffect, useCallback } from "react";
import type { Flight } from "../types/models";
import { config } from "../config";

interface UseAnchoredOptions {
  pollInterval?: number; // Intervalle en ms, 0 ou négatif désactive la récupération périodique
  debug?: boolean;
  onUserError?: (message: string) => void; // Erreurs destinées à être affichées à l’utilisateur
}

export default function useAnchored({
  pollInterval = 5000,
  debug = config.debug || config.environment === "development",
  onUserError,
}: UseAnchoredOptions = {}) {
  const [anchored, setAnchored] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dlog = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[useAnchored]", ...args);
      }
    },
    [debug]
  );

  useEffect(() => {
    /*
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchAnchored = async () => {
      abortController = new AbortController();
      setLoading(true);

      try {
        dlog("Récupération des vols ancrés...");
        const res = await fetch(
          config.apiUrl.replace(/\/$/, "") + "/anchored",
          { signal: abortController.signal }
        );

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const data: Flight[] = await res.json();
        if (!isMounted) return;

        setAnchored(data);
        setError(null);
        dlog(`${data.length} ancrage(s) récupéré(s)`);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message =
          err instanceof Error
            ? err.message
            : "Erreur inconnue lors de la récupération des vols ancrés";
        setError(message);
        if (onUserError) onUserError(message);
        if (debug) console.error("[useAnchored] Erreur :", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnchored();

    let intervalId: ReturnType<typeof setInterval> | undefined;
    if (pollInterval > 0) {
      intervalId = setInterval(fetchAnchored, pollInterval);
    }

    return () => {
      isMounted = false;
      abortController?.abort();
      if (intervalId) clearInterval(intervalId);
    };
    */
    dlog("useAnchored est en pause, fetch désactivé.");
  }, [pollInterval, dlog, debug, onUserError]);

  return { anchored, loading, error };
}
