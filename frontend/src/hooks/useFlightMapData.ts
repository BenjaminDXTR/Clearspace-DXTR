// src/hooks/useFlightMapData.ts

import { useState, useEffect, useMemo } from "react";
import type { Flight, LatLng } from "../types/models";
import { getFlightTrace, stripTimestampFromTrace } from "../utils/coords";
import { getFitForTrace } from "../utils/mapFit";

interface FlightMapData {
    points: LatLng[];
    center: [number, number] | null;
    zoom: number;
}

/**
 * Hook métier pour uniformiser la récupération des données de trace GPS,
 * calculer le centre et le zoom adaptés à la trace sélectionnée,
 * et permettre un rafraîchissement contrôlé sur trigger (flyToTrigger).
 *
 * @param selectedFlight vol sélectionné dont on extrait la trace
 * @param flyToTrigger valeur incrémentale qui déclenche le repositionnement/calcul
 * @returns objet avec points filtrés, centre et zoom adaptés
 */
export default function useFlightMapData(
    selectedFlight: Flight | null,
    flyToTrigger: number
): FlightMapData {
    const [center, setCenter] = useState<[number, number] | null>(null);
    const [zoom, setZoom] = useState<number>(13);
    const [points, setPoints] = useState<LatLng[]>([]);

    // Extraction et conversion des points tracés, mémorisés
    const normalizedPoints = useMemo(() => {
        if (!selectedFlight) return [];
        const rawTrace = getFlightTrace(selectedFlight);
        return stripTimestampFromTrace(rawTrace);
    }, [selectedFlight]);

    // Mise à jour des points dans l'état local uniquement si changement réel
    useEffect(() => {
        setPoints(normalizedPoints);
    }, [normalizedPoints]);

    // Calcul center et zoom adaptés à la trace sur trigger
    useEffect(() => {
        if (normalizedPoints.length === 0) {
            setCenter(null);
            setZoom(13);
            return;
        }
        const { center: fitCenter, zoom: fitZoom } = getFitForTrace(normalizedPoints, 10);
        setCenter(fitCenter);
        setZoom(fitZoom);
    }, [normalizedPoints, flyToTrigger]);

    return { points, center, zoom };
}
