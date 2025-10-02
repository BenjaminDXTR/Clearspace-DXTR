// src/hooks/useProcessedFlights.ts
import { useEffect, useMemo, useCallback } from "react";
import type { Flight } from "../types/models";
import useLocalHistory from "./useLocalHistory"; 

interface UseProcessedFlightsOptions {
  debug?: boolean;
  onUserError?: (message: string) => void;
}

interface UseProcessedFlightsResult {
  liveFlights: Flight[];         // Vols live filtrés et enrichis
  localFlights: Flight[];        // Vols locaux paginés et filtrés avec flag isAnchored
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[];
}

/**
 * Hook métier pour fusionner, filtrer, enrichir les vols live et locaux
 * - Reçoit en entrée : listes brutes du contexte DronesContext (hors du hook)
 * - Applique filtre coordonnées valides, enrichissement champ _type
 * - Gère pagination locale, passe isAnchored tel que fourni par backend
 */
export function useProcessedFlights(
  rawLiveFlights: Flight[],
  rawLocalFlights: Flight[],
  options: UseProcessedFlightsOptions = {},
  fetchHistory: (filename: string) => Promise<Flight[]>,
  historyFiles: string[]
): UseProcessedFlightsResult {
  const { debug = false, onUserError } = options;

  const debugLog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[useProcessedFlights]", ...args);
    }
  }, [debug]);

  const {
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    error: localHistoryError,
  } = useLocalHistory({ fetchHistory, historyFiles, debug, onUserError });

  // Surveiller l'erreur locale et remonter une erreur si besoin
  useEffect(() => {
    if (localHistoryError && onUserError) {
      onUserError(`Erreur historique local : ${localHistoryError}`);
    }
  }, [localHistoryError, onUserError]);

  useEffect(() => {
    debugLog(`Mise à jour vols locaux (rawLocalFlights), count: ${rawLocalFlights.length}`);
    setLocalHistory(rawLocalFlights);
  }, [rawLocalFlights, setLocalHistory, debugLog]);

  const liveFlights = useMemo(() => {
    const filtered: Flight[] = rawLiveFlights
      .filter((f: Flight) => f.latitude !== 0 && f.longitude !== 0 && !!f.id)
      .map((f: Flight) => ({ ...f, _type: "live" }));
    debugLog(`Vols live filtrés: ${filtered.length}`);
    return filtered;
  }, [rawLiveFlights, debugLog]);

  const localFlights = useMemo(() => {
    const filtered: Flight[] = localPageData
      .filter((f: Flight) => f && f.latitude !== 0 && f.longitude !== 0 && !!f.id)
      .map((f: Flight) => ({ ...f, _type: "local" }));
    debugLog(`Vols locaux page ${localPage} filtrés: ${filtered.length}`);
    return filtered;
  }, [localPageData, localPage, debugLog]);

  return {
    liveFlights,
    localFlights,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
  };
}
