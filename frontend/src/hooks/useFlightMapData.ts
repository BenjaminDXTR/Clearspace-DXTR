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
            dlog("Aucun vol valide");
            return [];
        }
        const rawTrace = getFlightTrace(safeSelectedFlight);
        const stripped = stripTimestampFromTrace(rawTrace);
        dlog(`Trace normalisée: ${stripped.length} points`);
        return stripped;
    }, [safeSelectedFlight, dlog]);

    useEffect(() => {
        const pointsChanged = normalizedPoints.length !== lastPointsRef.current.length
            || normalizedPoints.some((p1, i) => {
                const p2 = lastPointsRef.current[i];
                return !p2 || p1[0] !== p2[0] || p1[1] !== p2[1];
            });

        dlog(`Evaluating points update: pointsChanged=${pointsChanged}, flyToTrigger=${flyToTrigger}`);

        if (pointsChanged || flyToTrigger) {
            dlog("Mise à jour points");
            lastPointsRef.current = normalizedPoints;
            setPoints(normalizedPoints);
        }
    }, [normalizedPoints, flyToTrigger, dlog]);

    useEffect(() => {
        dlog(`flyToTrigger: ${flyToTrigger} recalcul centre/zoom`);

        if (normalizedPoints.length === 0) {
            dlog("Aucun point, conservation centre et zoom");
            setCenter(lastCenterRef.current);
            setZoom(lastZoomRef.current);
            return;
        }

        const { center: fitCenter, zoom: fitZoom } = getFitForTrace(normalizedPoints, 10);

        let centerChanged = false;
        if (!lastCenterRef.current
            || lastCenterRef.current[0] !== fitCenter[0]
            || lastCenterRef.current[1] !== fitCenter[1]) {
            dlog("Nouveau centre:", fitCenter);
            lastCenterRef.current = fitCenter;
            setCenter(fitCenter);
            centerChanged = true;
        } else {
            dlog("Centre inchangé, forçage rerender");
            setCenter([...fitCenter]);
            centerChanged = true;
        }

        if (lastZoomRef.current !== fitZoom) {
            dlog("Nouveau zoom:", fitZoom);
            lastZoomRef.current = fitZoom;
            setZoom(fitZoom);
        } else if (!centerChanged) {
            dlog("Zoom inchangé, force update");
            setZoom(prevZoom => prevZoom);
        }
    }, [normalizedPoints, flyToTrigger, dlog]);

    return { points, center, zoom };
}
