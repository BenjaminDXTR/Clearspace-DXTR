import { useState, useEffect, useCallback } from "react";
import type { Flight } from "../types/models";
import { config } from "../config";

interface UseAnchoredOptions {
  /** Intervalle entre deux rafraîchissements (ms). 0 ou négatif pour désactiver */
  pollInterval?: number;
  /** Activer les logs debug (par défaut en mode dev) */
  debug?: boolean;
}

export default function useAnchored({
  pollInterval = 5000,
  debug = config.debug || config.environment === "development",
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
  }, [pollInterval, dlog]);

  return { anchored, loading, error };
}
