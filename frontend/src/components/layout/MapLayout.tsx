import { useCallback, useEffect } from "react";
import FlightMap from "../common/FlightMap";
import type { Flight } from "../../types/models";
import useFlightMapData from "../../hooks/useFlightMapData";
import { config } from "../../config";
import "./MapLayout.css";

interface MapLayoutProps {
  selected?: Flight | null;
  exportObj: (obj: Flight) => void;
  debug?: boolean;
  title?: string;
  flyToTrigger?: number;
}

export default function MapLayout({
  selected,
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

  // Vérification explicite que selected est défini et valide
  const isSelectedValid = selected !== undefined && selected !== null && selected.id !== undefined;

  // Toujours appels des hooks dans le même ordre et sans condition
  const { points, center, zoom } = useFlightMapData(
    isSelectedValid ? selected : null,
    flyToTrigger ?? 0
  );

  // Vérification si la sélection est valide et points disponibles
  const hasValidPoints = isSelectedValid && points.length > 0;

  const startPosition = hasValidPoints ? points[0] : null;
  const livePosition = hasValidPoints ? points[points.length - 1] : null;

  useEffect(() => {
    dlog(`flyToTrigger prop changed: ${flyToTrigger}`);
  }, [flyToTrigger, dlog]);

  dlog(
    `[MapLayout] Vol sélectionné id=${isSelectedValid ? selected?.id : "N/A"} avec points count=${points.length}`
  );

  return (
    <div className="map-layout" aria-live="polite">
      <h2 className="map-layout__title">{title}</h2>
      <FlightMap
        trace={points}
        livePosition={livePosition}
        startPosition={startPosition}
        zoom={zoom}
        center={center}
        showMarkers={false}
        className="map-layout__leaflet"
        aria-label={`Carte ${hasValidPoints ? "avec" : "sans"} trace sélectionnée`}
      />
      {!hasValidPoints && (
        <div className="map-layout__no-trace" role="alert">
          Trace insuffisante pour affichage
        </div>
      )}
    </div>
  );
}
