import React, { useRef, useEffect, forwardRef, useImperativeHandle, useCallback, CSSProperties } from "react";
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

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

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

const FlightMap = forwardRef<HTMLDivElement, FlightMapProps>(({
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

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[FlightMap]", ...args);
    }
  }, [debug]);

  useImperativeHandle(ref, () => {
    if (mapRef.current) {
      const container = mapRef.current.getContainer();
      dlog("[FlightMap] Expose container ref", container);
      return container as HTMLDivElement;
    }
    dlog("[FlightMap] Ref container non définie");
    return null as unknown as HTMLDivElement;
  }, [mapRef.current]);

  const validTrace = trace.filter(isLatLng);
  const hasTrace = validTrace.length > 0;

  const computedCenter: [number, number] =
    center ??
    (hasTrace
      ? (validTrace[Math.floor(validTrace.length / 2)] as [number, number])
      : [48.8584, 2.2945]);

  useEffect(() => {
    dlog(`flyToTrigger reçu: ${flyToTrigger}`);
    dlog(`Position passée à FlyToPosition: ${JSON.stringify(toLatLngTuple(livePosition ?? startPosition))}`);
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
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      <FlightMarkers
        key={`flight-markers-${validTrace.length}`}
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
        position={toLatLngTuple(livePosition ?? startPosition) ?? computedCenter}
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
