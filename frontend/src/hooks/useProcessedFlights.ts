import { useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight } from "../types/models";
import useLocalHistory from "./useLocalHistory";

interface UseProcessedFlightsOptions {
  debug?: boolean;
  onUserError?: (message: string) => void;
}

interface UseProcessedFlightsResult {
  liveFlights: Flight[];
  localFlights: Flight[];
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[];
}

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

  const prevRawLocalFlightsRef = useRef<Flight[] | null>(null);

  useEffect(() => {
    if (
      rawLocalFlights.length === 0 &&
      prevRawLocalFlightsRef.current &&
      prevRawLocalFlightsRef.current.length === 0
    ) {
      return;
    }

    // Stockage de la référence courante
    prevRawLocalFlightsRef.current = rawLocalFlights;
    debugLog(`Mise à jour vols locaux (rawLocalFlights), count: ${rawLocalFlights.length}`);
    setLocalHistory(rawLocalFlights);
  }, [rawLocalFlights, setLocalHistory, debugLog]);

  useEffect(() => {
    if (localHistoryError && onUserError) {
      onUserError(`Erreur historique local : ${localHistoryError}`);
    }
  }, [localHistoryError, onUserError]);

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
