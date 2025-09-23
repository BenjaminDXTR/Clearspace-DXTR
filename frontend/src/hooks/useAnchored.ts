import { useState, useEffect } from "react";
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

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchAnchored = async () => {
      abortController = new AbortController();
      setLoading(true);

      try {
        dlog("[useAnchored] Récupération des vols ancrés...");
        const res = await fetch(
          config.apiUrl.replace(/\/$/, "") + "/anchored",
          { signal: abortController.signal }
        );

        const data: Flight[] = await res.json();
        if (!isMounted) return;

        setAnchored(data);
        setError(null);
        dlog(`[useAnchored] ${data.length} ancrage(s) récupéré(s)`);
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

    // Premier fetch
    fetchAnchored();

    // Polling si activé
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollInterval > 0) {
      intervalId = setInterval(fetchAnchored, pollInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (abortController) abortController.abort();
    };
  }, [pollInterval, debug]);

  return { anchored, loading, error };
}
