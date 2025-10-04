import { useRef, useEffect, forwardRef, useImperativeHandle, CSSProperties, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  CircleMarker,
  useMap,
  Popup,
} from "react-leaflet";
import L, { Icon, Map as LeafletMap, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { isLatLng } from "../../utils/coords";
import { droneIcon, historyIcon } from "../../utils/icons";
import "./FlightMap.css";

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
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
  debug?: boolean;
  livePosition?: LatLngExpression | null;
  startPosition?: LatLngExpression | null;
}

/**
 * Composant interne pour déplacer automatiquement la carte
 * dès que center ou zoom change, en utilisant map.flyTo().
 */
function MapAutoFlyTo({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.0 });
    }
  }, [center, zoom, map]);

  return null;
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
  debug = process.env.NODE_ENV === "development",
  livePosition = null,
  startPosition = null,
}, ref) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(ref, () => containerRef.current as HTMLElement, []);

  const validTrace = trace.filter(isLatLng);
  const hasTrace = validTrace.length > 0;

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[FlightMap]", ...args);
  }, [debug]);

  useEffect(() => {
    dlog("Received center:", center, "zoom:", zoom);
  }, [center, zoom, dlog]);

  const computedCenter: [number, number] = center ??
    (hasTrace ? (validTrace[Math.floor(validTrace.length / 2)] as [number, number]) : [48.8584, 2.2945]);

  return (
    <MapContainer
      ref={(mapInstance) => {
        mapRef.current = mapInstance;
      }}
      center={computedCenter}
      zoom={zoom}
      scrollWheelZoom
      style={style}
      className={`flight-map ${className}`}
      renderer={L.canvas()}
      aria-label="Carte du tracé de vol"
    >
      <InvalidateMapSize />
      <MapAutoFlyTo center={computedCenter} zoom={zoom} />
      <div ref={containerRef} className="leaflet-container" />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      {validTrace.length > 1 && (
        <>
          <Polyline positions={validTrace} pathOptions={polylineOptions} />
          {showMarkers && validTrace.map((pt, i) => (
            <CircleMarker
              key={`circle-${i}`}
              center={pt}
              radius={4}
              fillColor="#1976d2"
              color="#fff"
              weight={1}
              fillOpacity={0.9}
            />
          ))}
        </>
      )}

      {startPosition && (
        <Marker position={startPosition} icon={historyIcon}>
          <Popup>Position de départ</Popup>
        </Marker>
      )}

      {livePosition && (
        <Marker position={livePosition} icon={droneIcon}>
          <Popup>Position actuelle</Popup>
        </Marker>
      )}

      {markerIcon && hasTrace && !livePosition && (
        <Marker position={validTrace[validTrace.length - 1]} icon={markerIcon} />
      )}
    </MapContainer>
  );
});

FlightMap.displayName = "FlightMap";

export default FlightMap;
