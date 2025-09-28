import { useEffect, useMemo, useCallback, useState } from "react";
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

  const [zoom, setZoom] = useState(10);

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

  const points = useMemo<LatLng[]>(() => {
    if (Array.isArray(selectedTracePoints) && selectedTracePoints.length >= 2) {
      const filtered = selectedTracePoints.filter(isLatLng);
      dlog(`[MapLayout] Utilisation de selectedTracePoints filtrés, count: ${filtered.length}`);
      return filtered;
    }
    if (selected) {
      const trace = getFlightTrace(selected);
      const filtered = trace.filter(isLatLng);
      dlog(`[MapLayout] Utilisation de getFlightTrace sur vol sélectionné, count: ${filtered.length}`);
      return filtered;
    }
    dlog("[MapLayout] Pas de trace valide trouvée");
    return [];
  }, [selectedTracePoints, selected, dlog]);

  const hasValidPoints = points.length > 0;
  const startPosition = hasValidPoints ? points[0] : null;
  const livePosition = hasValidPoints ? points[points.length - 1] : null;

  useEffect(() => {
    if (selected && hasValidPoints) {
      setZoom(18);
      dlog(`Zoom augmenté à 18 pour vol id=${selected.id}`);
    }
  }, [selected, hasValidPoints, dlog]);

  return (
    <div className="map-layout">
      <div className="map-layout__map">
        <h2 className="map-layout__title">{title}</h2>
        <FlightMap
          trace={points}
          markerIcon={null}
          livePosition={livePosition}
          startPosition={startPosition}
          zoom={zoom}
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
