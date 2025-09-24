import { useState, useEffect, useMemo } from "react";
import type { Flight } from "../types/models";
import { PER_PAGE } from "../utils/constants";
import { config } from "../config";

interface UseLocalHistoryOptions {
  pollInterval?: number;
  debug?: boolean;
}

export default function useLocalHistory({
  pollInterval = 10000,
  debug = config.debug || config.environment === "development",
}: UseLocalHistoryOptions = {}) {
  const [localHistory, setLocalHistory] = useState<Flight[]>([]);
  const [localPage, setLocalPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dlog = (...args: any[]) => {
    if (debug) console.log("[useLocalHistory]", ...args);
  };

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchLocalHistory = async () => {
      abortController = new AbortController();
      setLoading(true);

      try {
        dlog("[useLocalHistory] Récupération de l'historique local...");
        const res = await fetch(config.apiUrl + "/history", { signal: abortController.signal });
        const data: Flight[] = await res.json();

        if (!isMounted) return;

        const filteredData = data.filter(d => d._type === "local");
        setLocalHistory(filteredData);

        setError(null);
        dlog(`[useLocalHistory] ${filteredData.length} vols archivés récupérés`);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message =
          err instanceof Error ? err.message : "Erreur inconnue lors de la récupération de l'historique local";
        setError(message);
        console.error("[useLocalHistory] Erreur:", message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLocalHistory();

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
