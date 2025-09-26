import { useEffect, useMemo, useCallback } from "react";
import FlightMap from "../common/FlightMap";
import DetailsPanel from "../flights/DetailsPanel";
import { isLatLng, getFlightTrace } from "../../utils/coords";
import type { Flight, LatLng } from "../../types/models";
import { config } from "../../config";
import "./MapLayout.css";

interface MapLayoutProps {
  selectedTracePoints?: LatLng[] | null;
  selectedTraceRaw?: unknown;
  selected?: Flight | null;
  detailFields?: string[];
  exportObj: (obj: Flight) => void;
  debug?: boolean;
  title?: string;
  flyToTrigger?: number;
}

export default function MapLayout({
  selectedTracePoints,
  selectedTraceRaw,
  selected,
  detailFields,
  exportObj,
  debug = config.debug || config.environment === "development",
  title = "Carte des détections",
  flyToTrigger,
}: MapLayoutProps) {
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[MapLayout]", ...args);
  }, [debug]);

  useEffect(() => {
    if (selected) {
      dlog(
        `[MapLayout] vol id=${selected.id ?? "N/A"} avec ${
          selectedTracePoints?.length ?? 0
        } point(s)`
      );
    } else {
      dlog("[MapLayout] sans sélection");
    }
  }, [selected, selectedTracePoints, dlog]);

  const points = useMemo<LatLng[]>(() => {
    if (Array.isArray(selectedTracePoints) && selectedTracePoints.length >= 2) {
      return selectedTracePoints.filter(isLatLng);
    }
    if (selected) {
      const trace = getFlightTrace(selected);
      return trace.filter(isLatLng);
    }
    return [];
  }, [selectedTracePoints, selected]);

  const hasValidPoints = points.length > 0;
  const startPosition = hasValidPoints ? points[0] : null;
  const livePosition = hasValidPoints ? points[points.length - 1] : null;

  return (
    <div className="map-layout">
      <div className="map-layout__map">
        <h2 className="map-layout__title">{title}</h2>
        <FlightMap
          trace={points}
          markerIcon={null}
          livePosition={livePosition}
          startPosition={startPosition}
          zoom={10}
          showMarkers={false}
          className="map-layout__leaflet"
          aria-label={`Carte ${hasValidPoints ? "avec" : "sans"} trace sélectionnée`}
          flyToTrigger={flyToTrigger}
        />
        {!hasValidPoints && (
          <div className="map-layout__no-trace">Trace insuffisante pour affichage</div>
        )}
      </div>

      <div className="map-layout__details">
        {selected ? (
          <DetailsPanel
            selected={selected}
            detailFields={detailFields}
            exportObj={exportObj}
            selectedTraceRaw={selectedTraceRaw}
            selectedTracePoints={points}
          />
        ) : (
          <div className="map-layout__no-selection">Sélectionnez un vol pour voir les détails</div>
        )}
      </div>
    </div>
  );
}
