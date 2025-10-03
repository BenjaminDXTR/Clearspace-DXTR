// src/components/layout/MapLayout.tsx

import { useEffect, useMemo, useCallback, useState } from "react";
import FlightMap from "../common/FlightMap";
import type { Flight, LatLngTimestamp } from "../../types/models";
import { stripTimestampFromTrace } from "../../utils/coords";
import { config } from "../../config";
import "./MapLayout.css";

interface MapLayoutProps {
  selectedTracePoints?: LatLngTimestamp[] | null;
  selectedTraceRaw?: unknown;
  selected?: Flight | null;
  exportObj: (obj: Flight) => void;
  debug?: boolean;
  title?: string;
  flyToTrigger?: number;
}

export default function MapLayout({
  selectedTracePoints,
  selectedTraceRaw,
  selected,
  exportObj,
  debug = config.debug || config.environment === "development",
  title = "Carte des détections",
  flyToTrigger,
}: MapLayoutProps) {
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[MapLayout]", ...args);
    }
  }, [debug]);

  const points = useMemo(() => {
    if (selectedTracePoints && selectedTracePoints.length >= 2) {
      const filtered = stripTimestampFromTrace(selectedTracePoints);
      dlog(`[MapLayout] Utilisation de selectedTracePoints filtrés, count: ${filtered.length}`);
      return filtered;
    }
    dlog("[MapLayout] Pas de trace valide trouvée");
    return [];
  }, [selectedTracePoints, dlog]);

  const hasValidPoints = points.length > 0;
  const startPosition = hasValidPoints ? points[0] : null;
  const livePosition = hasValidPoints ? points[points.length - 1] : null;

  useEffect(() => {
    if (selected) {
      dlog(`[MapLayout] Vol sélectionné id=${selected.id ?? "N/A"} avec ${selectedTracePoints?.length ?? 0} point(s)`);
      if (selectedTraceRaw) {
        dlog("[MapLayout] Trace brute (selectedTraceRaw) présente");
      }
    } else {
      dlog("[MapLayout] Aucun vol sélectionné");
    }
  }, [selected, selectedTracePoints, selectedTraceRaw, dlog]);

  return (
    <div className="map-layout">
      <h2 className="map-layout__title">{title}</h2>
      <FlightMap
        trace={points}
        livePosition={livePosition}
        startPosition={startPosition}
        zoom={13}              // Laisse zoom par défaut, on fait fit via fitToTrace
        showMarkers={false}
        fitToTrace={true}      // Activation du zoom auto/centrage sur trace
        className="map-layout__leaflet"
        aria-label={`Carte ${hasValidPoints ? "avec" : "sans"} trace sélectionnée`}
        flyToTrigger={flyToTrigger}
      />
      {!hasValidPoints && (
        <div className="map-layout__no-trace">Trace insuffisante pour affichage</div>
      )}
    </div>
  );
}
