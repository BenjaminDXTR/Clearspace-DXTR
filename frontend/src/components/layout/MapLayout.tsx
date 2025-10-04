// src/components/layout/MapLayout.tsx

import { useCallback } from "react";
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

  const { points, center, zoom } = useFlightMapData(selected ?? null, flyToTrigger ?? 0);

  const hasValidPoints = points.length > 0;
  const startPosition = hasValidPoints ? points[0] : null;
  const livePosition = hasValidPoints ? points[points.length - 1] : null;

  dlog(
    `[MapLayout] Vol sélectionné id=${selected?.id ?? "N/A"} avec points count=${points.length}`
  );

  return (
    <div className="map-layout">
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
        <div className="map-layout__no-trace">Trace insuffisante pour affichage</div>
      )}
    </div>
  );
}
