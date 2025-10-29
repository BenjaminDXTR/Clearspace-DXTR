// src/hooks/useProcessedFlights.ts
import { useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight } from "../types/models";
import useLocalHistory from "./useLocalHistory";
import useDebugLogger from "./useDebugLogger";

interface UseProcessedFlightsOptions {
  debug?: boolean;
  onUserError?: (message: string) => void;
}

interface UseProcessedFlightsResult {
  liveFlights: (Flight & { state: "live" | "waiting" })[];
  localFlights: (Flight & { state: "local"; anchorState: "none" | "pending" | "anchored" })[];
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[];
}

/**
 * Hook métier pour traiter, filtrer et fusionner les vols live et locaux (historique).
 * Inclut désormais vols en état "waiting" dans liveFlights.
 * Enrichit localFlights avec l'état d'ancrage (anchorState) AVANT pagination.
 *
 * @param rawLiveFlights Vols bruts live reçus du backend via WebSocket
 * @param rawLocalFlights Vols historiques chargés (avant pagination)
 * @param options Options debug et gestion erreur utilisateur
 * @param fetchHistory Fonction récupération historique par fichier
 * @param historyFiles Liste fichiers historique disponible
 * @returns Données traitées et paginées pour consommation UI enrichies de l'état d'ancrage
 */
export function useProcessedFlights(
  rawLiveFlights: Flight[],
  rawLocalFlights: Flight[],
  options: UseProcessedFlightsOptions = {},
  fetchHistory: (filename: string) => Promise<Flight[]>,
  historyFiles: string[]
): UseProcessedFlightsResult {
  const { debug = false, onUserError } = options;

  // Logger conditionnel
  const debugLog = useDebugLogger(debug, "useProcessedFlights");

  // Hook local history pour chargement et pagination des vols locaux
  const {
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    error: localHistoryError,
  } = useLocalHistory({ fetchHistory, historyFiles, debug, onUserError });

  // Ref pour optimiser la mise à jour des vols locaux
  const prevRawLocalFlightsRef = useRef<Flight[] | null>(null);

  // Mise à jour locale avec optimisation pour éviter mises à jour inutiles
  useEffect(() => {
    if (rawLocalFlights.length === 0 && prevRawLocalFlightsRef.current?.length === 0) {
      return;
    }
    prevRawLocalFlightsRef.current = rawLocalFlights;
    debugLog(`Mise à jour des vols locaux reçus, count: ${rawLocalFlights.length}`);
    setLocalHistory(rawLocalFlights);
  }, [rawLocalFlights, setLocalHistory, debugLog]);

  // Gestion des erreurs de l'historique local
  useEffect(() => {
    if (localHistoryError && onUserError) {
      onUserError(`Erreur historique local : ${localHistoryError}`);
    }
  }, [localHistoryError, onUserError]);

  // Filtrer vols live incluant aussi "waiting"
  const liveFlights = useMemo(() => {
    const filtered = rawLiveFlights
      .filter(
        (flight) =>
          (flight.state === "live" || flight.state === "waiting") &&
          typeof flight.latitude === "number" &&
          typeof flight.longitude === "number" &&
          flight.latitude !== 0 &&
          flight.longitude !== 0 &&
          !!flight.id
      )
      .map((flight) => ({ ...flight, state: flight.state as "live" | "waiting" }));
    debugLog(`Vols live et waiting filtrés: ${filtered.length}`);
    return filtered;
  }, [rawLiveFlights, debugLog]);

  /**
   * Fonction simulée ou reçue en props/calculée ici qui retourne l'état d'ancrage
   * Elle peut provenir d'un contexte ou un autre hook.
   * Ici on simule une fonction getAnchorState pour l'exemple.
   */
  const getAnchorState = useCallback(
    (id: string, created_time: string): "none" | "pending" | "anchored" => {
      // Exemple fictif : A remplacer par la vraie logique basée sur un état global ou cache
      return "none";
    },
    []
  );

  // Enrichir localPageData avec l'état d'ancrage AVANT pagination dans localFlights
  const localFlights = useMemo(() => {
    const enriched = localPageData
      .filter(
        (flight) =>
          flight !== null &&
          typeof flight.latitude === "number" &&
          typeof flight.longitude === "number" &&
          flight.latitude !== 0 &&
          flight.longitude !== 0 &&
          !!flight.id
      )
      .map((flight) => ({
        ...flight,
        state: "local" as const,
        anchorState: getAnchorState(flight.id ?? "", flight.created_time ?? ""),
      }));
    debugLog(`Vols locaux page ${localPage} filtrés et enrichis avec anchorState: ${enriched.length}`);
    return enriched;
  }, [localPageData, localPage, debugLog, getAnchorState]);

  return {
    liveFlights,
    localFlights,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
  };
}
