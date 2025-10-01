// src/hooks/useProcessedFlights.ts
import { useEffect, useMemo, useCallback } from "react";
import type { Flight } from "../types/models";
import useLocalHistory from "./useLocalHistory"; // Import par défaut corrigé

interface UseProcessedFlightsOptions {
    debug?: boolean;
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
    historyFiles: string[],
): UseProcessedFlightsResult {
    const { debug = false } = options;

    const debugLog = useCallback((...args: unknown[]) => {
        if (debug) {
            console.log("[useProcessedFlights]", ...args);
        }
    }, [debug]);

    // Utilisation hook pagination localHistory (gère l’état interne)
    const {
        setLocalHistory,
        localPage,
        setLocalPage,
        localMaxPage,
        localPageData,
    } = useLocalHistory({ fetchHistory, historyFiles, debug });

    // Synchroniser localHistory avec rawLocalFlights
    useEffect(() => {
        debugLog(`Mise à jour vols locaux (rawLocalFlights), count: ${rawLocalFlights.length}`);
        // Conserver le flag isAnchored provenant du backend dans chaque vol local
        setLocalHistory(rawLocalFlights);
    }, [rawLocalFlights, setLocalHistory, debugLog]);

    // Filtrage vols live valides avec ajout _type = "live"
    const liveFlights = useMemo(() => {
        const filtered: Flight[] = rawLiveFlights
            .filter((f: Flight) => f.latitude !== 0 && f.longitude !== 0 && !!f.id)
            .map((f: Flight) => ({ ...f, _type: "live" }));
        debugLog(`Vols live filtrés: ${filtered.length}`);
        return filtered;
    }, [rawLiveFlights, debugLog]);

    // Filtrage locaux paginés valides avec _type = "local" et isAnchored passé tel quel
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
