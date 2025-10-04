import { useCallback, useEffect, useState } from "react";
import FlightMap from "../common/FlightMap";
import type { Flight, LatLng, LatLngTimestamp } from "../../types/models";
import { getFitForTrace } from "../../utils/mapFit";
import { stripTimestampFromTrace } from "../../utils/coords";
import { config } from "../../config";
import "./MapLayout.css";

interface MapLayoutProps {
  selected?: Flight | null;
  selectedTracePoints?: LatLng[] | LatLngTimestamp[] | null;
  selectedTraceRaw?: unknown;
  exportObj: (obj: Flight) => void;
  debug?: boolean;
  title?: string;
  flyToTrigger?: number; // Pour cohérence avec useAppLogic
}

export default function MapLayout({
  selected,
  selectedTracePoints,
  selectedTraceRaw,
  exportObj,
  debug = config.debug || config.environment === "development",
  title = "Carte des détections",
  flyToTrigger,
}: MapLayoutProps) {
  const dlog = useCallback(
    (...args: unknown[]) => {
      if (debug) {
        console.log("[MapLayout]", ...args);
      }
    },
    [debug]
  );

  const isSelectedValid =
    selected !== undefined &&
    selected !== null &&
    selected.id !== undefined &&
    selected.id !== null &&
    selected.id !== "";

  // Nettoyage si trace avec timestamps
  let cleanPoints: LatLng[] = [];
  if (selectedTracePoints && selectedTracePoints.length > 0) {
    if (
      Array.isArray(selectedTracePoints[0]) &&
      (selectedTracePoints[0] as any).length === 3
    ) {
      cleanPoints = stripTimestampFromTrace(
        selectedTracePoints as LatLngTimestamp[]
      );
    } else {
      cleanPoints = selectedTracePoints as LatLng[];
    }
  }

  const points = cleanPoints;
  const hasValidPoints = isSelectedValid && points.length > 0;

  const startPosition = hasValidPoints ? points[0] : null;
  const livePosition = hasValidPoints ? points[points.length - 1] : null;

  // États pour mémoriser le centre/zoom basé sur le vol sélectionné
  const [storedCenter, setStoredCenter] = useState<[number, number] | null>(null);
  const [storedZoom, setStoredZoom] = useState<number>(13);
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSelectedValid) return;

    if (selected?.id !== prevSelectedId) {
      const { center: newCenter, zoom: newZoom } = getFitForTrace(points, 10);
      setStoredCenter(newCenter);
      setStoredZoom(newZoom);
      setPrevSelectedId(selected.id);
      dlog(`[MapLayout] Sélection vol changée (${selected.id}), mise à jour centre/zoom`);
    } else {
      dlog(`[MapLayout] Même vol sélectionné, pas de repositionnement carte`);
    }
  }, [selected, points, prevSelectedId, isSelectedValid, dlog]);

  // Utilisation du centre/zoom stocké pour le rendu carte
  const centerToUse = storedCenter;
  const zoomToUse = storedZoom;

  useEffect(() => {
    dlog("flyToTrigger prop changed:", flyToTrigger);
  }, [flyToTrigger, dlog]);

  useEffect(() => {
    dlog("points updated: ", points);
  }, [points, dlog]);

  dlog(
    `[MapLayout] Vol sélectionné id=${
      isSelectedValid ? selected?.id : "N/A"
    } avec points count=${points.length}`
  );

  dlog(
    `[MapLayout] Positions envoyées à FlightMap - startPosition: ${startPosition}, livePosition: ${livePosition}, center: ${centerToUse}, zoom: ${zoomToUse}`
  );

  return (
    <div className="map-layout" aria-live="polite">
      <h2 className="map-layout__title">{title}</h2>
      <FlightMap
        trace={points}
        livePosition={livePosition}
        startPosition={startPosition}
        zoom={zoomToUse ?? 13}
        center={centerToUse ?? null}
        showMarkers={false}
        className="map-layout__leaflet"
        aria-label={`Carte ${hasValidPoints ? "avec" : "sans"} trace sélectionnée`}
        flyToTrigger={flyToTrigger}
      />
      {!hasValidPoints && (
        <div className="map-layout__no-trace" role="alert">
          Trace insuffisante pour affichage
        </div>
      )}
    </div>
  );
}
