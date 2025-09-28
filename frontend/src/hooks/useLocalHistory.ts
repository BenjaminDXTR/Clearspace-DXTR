import { useState, useEffect, useMemo, useRef } from "react";
import type { Flight } from "../types/models";
import { PER_PAGE } from "../utils/constants";
import { config } from "../config";

interface UseLocalHistoryOptions {
  pollInterval?: number; // Désuet ici, laissé pour compatibilité
  debug?: boolean;
}

export default function useLocalHistory({
  pollInterval = 0,
  debug = config.debug || config.environment === "development",
}: UseLocalHistoryOptions = {}) {
  const [localHistory, setLocalHistory] = useState<Flight[]>([]);
  const [localPage, setLocalPage] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualUpdatesRef = useRef<Map<string, Flight>>(new Map());

  const dlog = (...args: any[]) => {
    if (debug) console.log("[useLocalHistory]", ...args);
  };

  // Fusion des vols (cache local ignorable si backend garantit fraîcheur)
  const mergeFlights = (local: Flight[], fresh: Flight[]) => {
    const freshMap = new Map(fresh.map(f => [f.id + (f.created_time ?? ""), f]));
    const merged = local.map(flight => {
      const key = flight.id + (flight.created_time ?? "");
      if (freshMap.has(key)) {
        return freshMap.get(key)!;
      }
      return flight;
    });
    fresh.forEach(flight => {
      const key = flight.id + (flight.created_time ?? "");
      if (!merged.some(f => (f.id + (f.created_time ?? "")) === key)) {
        merged.push(flight);
      }
    });
    return merged;
  };

  // Mise à jour locale, avec merge et mise à jour du ref manuel
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

  // Fonction pour mettre localHistory manuellement (chargement fichier historique)
  const setLocalHistoryManual = (flights: Flight[]) => {
    // Filtrer seulement les vols local archivés
    const filteredLocals = flights.filter(f => f._type === "local");
    setLocalHistoryWithMerge(() => filteredLocals);
    setLocalPage(1);
  };

  // Pagination calculée
  const localMaxPage = useMemo(() => Math.max(1, Math.ceil(localHistory.length / PER_PAGE)), [localHistory]);
  const localPageData = useMemo(
    () => localHistory.slice((localPage - 1) * PER_PAGE, localPage * PER_PAGE),
    [localHistory, localPage]
  );

  return {
    localHistory,
    setLocalHistory: setLocalHistoryManual,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    loading,
    error,
  };
}
