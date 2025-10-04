import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight, LatLng } from "../types/models";
import { getFlightTrace, stripTimestampFromTrace } from "../utils/coords";
import { getFitForTrace } from "../utils/mapFit";

interface FlightMapData {
    points: LatLng[];
    center: [number, number] | null;
    zoom: number;
}

export default function useFlightMapData(
    selectedFlight: Flight | null,
    flyToTrigger: number
): FlightMapData {
    const lastCenterRef = useRef<[number, number] | null>(null);
    const lastZoomRef = useRef<number>(13);
    const lastPointsRef = useRef<LatLng[]>([]);

    const [center, setCenter] = useState<[number, number] | null>(null);
    const [zoom, setZoom] = useState<number>(13);
    const [points, setPoints] = useState<LatLng[]>([]);

    const dlog = useCallback((...args: unknown[]) => {
        if (process.env.NODE_ENV === "development") {
            console.log("[useFlightMapData]", ...args);
        }
    }, []);

    const safeSelectedFlight = selectedFlight && selectedFlight.trace ? selectedFlight : null;

    const normalizedPoints = useMemo(() => {
        if (!safeSelectedFlight) {
            dlog("Aucun vol valide, trace vide");
            return [];
        }
        const rawTrace = getFlightTrace(safeSelectedFlight);
        const stripped = stripTimestampFromTrace(rawTrace);
        dlog(`Trace normalisée : ${stripped.length} points`);
        return stripped;
    }, [safeSelectedFlight, dlog]);

    useEffect(() => {
        const pointsAreEqual =
            points.length === normalizedPoints.length &&
            points.every((p, i) => p[0] === normalizedPoints[i]?.[0] && p[1] === normalizedPoints[i]?.[1]);
        if (!pointsAreEqual) {
            dlog(`MAJ points : ${normalizedPoints.length} points`);
            lastPointsRef.current = normalizedPoints;
            setPoints(normalizedPoints);
        }
    }, [normalizedPoints, points, dlog]);

    useEffect(() => {
        dlog(`flyToTrigger: ${flyToTrigger} -> recalcul centre/zoom`);
        if (normalizedPoints.length === 0) {
            dlog("Pas de trace, on conserve dernier centre");
            setCenter(lastCenterRef.current);
            setZoom(lastZoomRef.current);
            return;
        }
        const { center: fitCenter, zoom: fitZoom } = getFitForTrace(normalizedPoints, 10);

        if (
            !lastCenterRef.current ||
            lastCenterRef.current[0] !== fitCenter[0] ||
            lastCenterRef.current[1] !== fitCenter[1]
        ) {
            dlog("Nouveau centre : ", fitCenter);
            lastCenterRef.current = fitCenter;
            setCenter(fitCenter);
        } else {
            dlog("Centre inchangé");
        }

        if (lastZoomRef.current !== fitZoom) {
            dlog("Nouveau zoom : ", fitZoom);
            lastZoomRef.current = fitZoom;
            setZoom(fitZoom);
        } else {
            dlog("Zoom inchangé");
        }
    }, [normalizedPoints, flyToTrigger, dlog]);

    return { points, center, zoom };
}
