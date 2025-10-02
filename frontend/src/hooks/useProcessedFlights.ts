import { useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight } from "../types/models";
import useLocalHistory from "./useLocalHistory";

interface UseProcessedFlightsOptions {
    debug?: boolean;
    onUserError?: (message: string) => void;
}

interface UseProcessedFlightsResult {
    liveFlights: (Flight & { _type: "live" })[];
    localFlights: (Flight & { _type: "local" })[];
    localPage: number;
    setLocalPage: (page: number) => void;
    localMaxPage: number;
    localPageData: Flight[];
}

/**
 * Hook métier pour traiter, filtrer et fusionner les vols live et locaux (historique).
 * 
 * @param rawLiveFlights Vols bruts en live reçus du backend via WebSocket.
 * @param rawLocalFlights Vols bruts locaux paginés chargés via useLocalHistory.
 * @param options Options debug et callback d’erreur utilisateur.
 * @param fetchHistory Fonction permettant de récupérer un historique par fichier.
 * @param historyFiles Liste des fichiers d’historique disponibles.
 * @returns Données traitées prêtes à être consommées par l’UI.
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

    // Utilisation du hook localHistory pour gestion des vols locaux paginés
    const {
        setLocalHistory,
        localPage,
        setLocalPage,
        localMaxPage,
        localPageData,
        error: localHistoryError,
    } = useLocalHistory({ fetchHistory, historyFiles, debug, onUserError });

    // Mémo de la référence précédente des vols locaux bruts pour éviter traitements inutiles
    const prevRawLocalFlightsRef = useRef<Flight[] | null>(null);

    // Quand les données brutes locales évoluent, on met à jour l’historique local dans useLocalHistory
    useEffect(() => {
        // Optimisation rapide : si tableau vide et précédent aussi vide, pas de traitement
        if (
            rawLocalFlights.length === 0 &&
            prevRawLocalFlightsRef.current &&
            prevRawLocalFlightsRef.current.length === 0
        ) {
            return;
        }

        // Mise à jour de la référence précédente et mise à jour de l’historique local
        prevRawLocalFlightsRef.current = rawLocalFlights;
        debugLog(`Mise à jour des vols locaux reçus, count: ${rawLocalFlights.length}`);
        setLocalHistory(rawLocalFlights);
    }, [rawLocalFlights, setLocalHistory, debugLog]);

    // Gestion des erreurs liées à l’historique local
    useEffect(() => {
        if (localHistoryError && onUserError) {
            onUserError(`Erreur historique local : ${localHistoryError}`);
        }
    }, [localHistoryError, onUserError]);

    // Filtrage et enrichissement des vols live
    const liveFlights = useMemo(() => {
        const filtered: (Flight & { _type: "live" })[] = rawLiveFlights
            .filter((flight: Flight) =>
                typeof flight.latitude === "number"
                && typeof flight.longitude === "number"
                && flight.latitude !== 0
                && flight.longitude !== 0
                && !!flight.id
            )
            .map((flight: Flight) => ({ ...flight, _type: "live" }));
        debugLog(`Vols live filtrés: ${filtered.length}`);
        return filtered;
    }, [rawLiveFlights, debugLog]);

    // Filtrage et enrichissement des vols locaux paginés
    const localFlights = useMemo(() => {
        const filtered: (Flight & { _type: "local" })[] = localPageData
            .filter((flight: Flight) =>
                flight !== null
                && typeof flight.latitude === "number"
                && typeof flight.longitude === "number"
                && flight.latitude !== 0
                && flight.longitude !== 0
                && !!flight.id
            )
            .map((flight: Flight) => ({ ...flight, _type: "local" }));
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
