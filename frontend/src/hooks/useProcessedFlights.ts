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
    localFlights: (Flight & { state: "local" })[];
    localPage: number;
    setLocalPage: (page: number) => void;
    localMaxPage: number;
    localPageData: Flight[];
}

/**
 * Hook métier pour traiter, filtrer et fusionner les vols live et locaux (historique).
 * Inclut désormais vols en état "waiting" dans liveFlights.
 * 
 * @param rawLiveFlights Vols bruts live reçus du backend via WebSocket
 * @param rawLocalFlights Vols historiques paginés chargés
 * @param options Options debug et gestion erreur utilisateur
 * @param fetchHistory Fonction récupération historique par fichier
 * @param historyFiles Liste fichiers historique disponible
 * @returns Données traitées pour consumption UI
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

    // Hook local history
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
        // Optimisation : éviter mise à jour inutile si tableau local égal au précédent
        if (rawLocalFlights.length === 0 && prevRawLocalFlightsRef.current && prevRawLocalFlightsRef.current.length === 0) {
            return;
        }
        prevRawLocalFlightsRef.current = rawLocalFlights;
        debugLog(`Mise à jour des vols locaux reçus, count: ${rawLocalFlights.length}`);
        setLocalHistory(rawLocalFlights);
    }, [rawLocalFlights, setLocalHistory, debugLog]);

    useEffect(() => {
        if (localHistoryError && onUserError) {
            onUserError(`Erreur historique local : ${localHistoryError}`);
        }
    }, [localHistoryError, onUserError]);

    // Filtrer vols live incluant aussi "waiting"
    const liveFlights = useMemo(() => {
        const filtered = rawLiveFlights
            .filter((flight) =>
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

    // Filtrer vols historiques locaux
    const localFlights = useMemo(() => {
        const filtered: (Flight & { state: "local" })[] = localPageData
            .filter((flight) =>
                flight !== null &&
                typeof flight.latitude === "number" &&
                typeof flight.longitude === "number" &&
                flight.latitude !== 0 &&
                flight.longitude !== 0 &&
                !!flight.id
            )
            .map((flight) => ({ ...flight, state: "local" }));
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
