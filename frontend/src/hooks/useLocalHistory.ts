import { useState, useEffect, useMemo } from "react";
import type { Flight } from "../types/models";
import { HISTORY_URL, PER_PAGE } from "../utils/constants";

interface UseLocalHistoryOptions {
  /** Intervalle entre deux rafraîchissements (ms). 0 ou négatif pour désactiver */
  pollInterval?: number;
  /** Activer les logs debug (par défaut : en dev) */
  debug?: boolean;
}

export default function useLocalHistory({
  pollInterval = 10000,
  debug = process.env.NODE_ENV === "development",
}: UseLocalHistoryOptions = {}) {
  const [localHistory, setLocalHistory] = useState<Flight[]>([]);
  const [localPage, setLocalPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchLocalHistory = async () => {
      abortController = new AbortController();
      setLoading(true);

      try {
        dlog("[useLocalHistory] Récupération de l'historique local...");
        const res = await fetch(HISTORY_URL, { signal: abortController.signal });
        const data: Flight[] = await res.json();
        if (!isMounted) return;

        setLocalHistory(data.reverse());
        setError(null);
        dlog(`[useLocalHistory] ${data.length} vols récupérés`);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message =
          err instanceof Error ? err.message : "Erreur inconnue lors de la récupération de l'historique local";
        setError(message);
        if (debug) console.error("[useLocalHistory] Erreur:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Premier fetch
    fetchLocalHistory();

    // Polling si activé
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollInterval > 0) {
      intervalId = setInterval(fetchLocalHistory, pollInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (abortController) abortController.abort();
    };
  }, [pollInterval, debug]);

  // Pagination
  const localMaxPage = useMemo(
    () => Math.max(1, Math.ceil(localHistory.length / PER_PAGE)),
    [localHistory]
  );

  const localPageData = useMemo(
    () => localHistory.slice((localPage - 1) * PER_PAGE, localPage * PER_PAGE),
    [localHistory, localPage]
  );

  return {
    localHistory,
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    loading,
    error,
  };
}
