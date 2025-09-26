import { useState, useEffect, useMemo, useRef } from "react";
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

  const manualUpdatesRef = useRef<Map<string, Flight>>(new Map());

  const dlog = (...args: any[]) => {
    if (debug) console.log("[useLocalHistory]", ...args);
  };

  // Fonction pour fusionner deux listes de vols de manière intelligente
  const mergeFlights = (local: Flight[], fresh: Flight[]) => {
    const freshMap = new Map(fresh.map(f => [f.id + (f.created_time ?? ""), f]));
    const merged = local.map(flight => {
      const key = flight.id + (flight.created_time ?? "");
      if (freshMap.has(key)) {
        return freshMap.get(key)!; // Priorité à données récentes du serveur
      }
      return flight; // Garder les entrées locales non présentes dans le fetch
    });
    // Ajouter les nouveaux vols du serveur absents localement
    fresh.forEach(flight => {
      const key = flight.id + (flight.created_time ?? "");
      if (!merged.some(f => (f.id + (f.created_time ?? "")) === key)) {
        merged.push(flight);
      }
    });
    return merged;
  };

  // Mise à jour manuelle depuis l'extérieur, enregistrer en Ref
  const setLocalHistoryWithMerge = (updater: (old: Flight[]) => Flight[]) => {
    setLocalHistory(old => {
      const updated = updater(old);
      updated.forEach(flight => {
        const key = flight.id + (flight.created_time ?? "");
        manualUpdatesRef.current.set(key, flight);
      });
      return updated;
    });
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
        const dataRaw: Flight[] = await res.json();

        if (!isMounted) return;

        const filteredData = dataRaw.filter(d => d._type === "local");
        dlog(`[useLocalHistory] ${filteredData.length} vols archivés récupérés`);

        // Fusion des données avec les modifications manuelles
        const mergedData = mergeFlights(Array.from(manualUpdatesRef.current.values()), filteredData);
        if (isMounted) setLocalHistory(mergedData);

        setError(null);
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
    setLocalHistory: setLocalHistoryWithMerge, // expose la version améliorée
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    loading,
    error,
  };
}
