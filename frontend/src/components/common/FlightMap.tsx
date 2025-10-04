import { useRef, useEffect, forwardRef, useImperativeHandle, CSSProperties, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
} from "react-leaflet";
import L, { Icon, Map as LeafletMap, LatLngExpression, LatLngLiteral, LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { isLatLng } from "../../utils/coords";
import FlightMarkers from "./FlightMarkers";
import FlyToPosition from "./FlyToPosition";
import "./FlightMap.css";

/** Hook qui force Leaflet à recalculer la taille de la carte */
function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Fonction utilitaire de conversion
function toLatLngTuple(pos: LatLngLiteral | LatLngTuple | null | undefined): LatLngTuple | null {
  if (!pos) return null;
  if (Array.isArray(pos)) return pos as LatLngTuple;
  return [pos.lat, pos.lng];
}

interface FlightMapProps {
  trace?: LatLngExpression[];
  markerIcon?: Icon | null;
  zoom?: number;
  style?: CSSProperties;
  className?: string;
  showMarkers?: boolean;
  center?: [number, number] | null;
  polylineOptions?: L.PathOptions;
  circleMarkerRadius?: number;
  circleMarkerFillColor?: string;
  circleMarkerColor?: string;
  flyToDurationSec?: number;
  debug?: boolean;
  livePosition?: LatLngLiteral | LatLngTuple | null;
  startPosition?: LatLngLiteral | LatLngTuple | null;
  flyToTrigger?: number;
}

const FlightMap = forwardRef<HTMLElement, FlightMapProps>(({
  trace = [],
  markerIcon = null,
  zoom = 13,
  style,
  className = "",
  showMarkers = true,
  center = null,
  polylineOptions = { color: "#c00", weight: 2 },
  circleMarkerRadius = 4,
  circleMarkerFillColor = "#1976d2",
  circleMarkerColor = "#fff",
  flyToDurationSec = 1.0,
  debug = process.env.NODE_ENV === "development",
  livePosition = null,
  startPosition = null,
  flyToTrigger,
}, ref) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[FlightMap]", ...args);
    }
  }, [debug]);

  // Expose via ref the Leaflet container div for capture
  useImperativeHandle(ref, () => containerRef.current as HTMLElement, []);

  // Filtrage des points valides
  const validTrace = trace.filter(isLatLng);
  const hasTrace = validTrace.length > 0;

  // Centre initial : props center > milieu trace > Paris par défaut
  const computedCenter: [number, number] =
    center ??
    (hasTrace
      ? (validTrace[Math.floor(validTrace.length / 2)] as [number, number])
      : [48.8584, 2.2945]);

  useEffect(() => {
    dlog(`flyToTrigger received: ${flyToTrigger}`);
    dlog(`Position passed to FlyToPosition: ${JSON.stringify(toLatLngTuple(livePosition ?? startPosition))}`);
  }, [flyToTrigger, livePosition, startPosition, dlog]);

  return (
    <MapContainer
      ref={mapRef}
      center={computedCenter}
      zoom={zoom}
      scrollWheelZoom
      style={style}
      className={`flight-map ${className}`}
      renderer={L.canvas()}
      aria-label="Carte du tracé de vol"
    >
      <InvalidateMapSize />
      <div ref={containerRef} className="leaflet-container" />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      <FlightMarkers
        key={`flight-markers-${validTrace.length}`} // clé ajoutée pour forcer re-render quand trace change
        trace={validTrace}
        showMarkers={showMarkers}
        markerIcon={markerIcon}
        startPosition={startPosition}
        livePosition={livePosition}
        polylineOptions={polylineOptions}
        circleMarkerRadius={circleMarkerRadius}
        circleMarkerFillColor={circleMarkerFillColor}
        circleMarkerColor={circleMarkerColor}
      />

      <FlyToPosition
        position={toLatLngTuple(livePosition ?? startPosition)}
        zoom={zoom}
        flyToTrigger={flyToTrigger}
        duration={flyToDurationSec}
        debug={debug}
      />
    </MapContainer>
  );
});

FlightMap.displayName = "FlightMap";

export default FlightMap;
