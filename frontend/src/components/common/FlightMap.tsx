import { useRef, useEffect, CSSProperties } from "react";
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

/** Hook : forcer le recalcul du rendu Leaflet */
function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [map]);
  return null;
}

/**
 * Composant utilitaire pour centrer et animer la carte Leaflet vers une position donnée.
 * Le recentrage est déclenché uniquement à chaque changement de `flyToTrigger`.
 */
function FlyToPosition({
  position,
  zoom,
  flyToTrigger,
}: {
  position: LatLngExpression | null;
  zoom: number;
  flyToTrigger?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (flyToTrigger !== undefined && position && Array.isArray(position)) {
      map.flyTo(position, zoom, { duration: 1.0 });
    }
  }, [flyToTrigger, position, zoom]);

  return null;
}

interface FlightMapProps {
  trace?: LatLngExpression[];
  markerIcon?: Icon | null; // Icône optionnelle pour marqueur final
  zoom?: number;
  style?: CSSProperties;
  className?: string;
  showMarkers?: boolean;  // Afficher les marqueurs intermédiaires
  center?: [number, number] | null;
  polylineOptions?: L.PathOptions;
  debug?: boolean;

  /** Position actuelle live (dernier point de la trace) */
  livePosition?: LatLngExpression | null;
  /** Position départ historique (premier point de la trace) */
  startPosition?: LatLngExpression | null;
  /** Trigger pour forcer le recentrage même si la position ne change pas */
  flyToTrigger?: number;
}

export default function FlightMap({
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
  flyToTrigger,
}: FlightMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const dlog = (...args: any[]) => {
    if (debug) console.log("[FlightMap]", ...args);
  };

  // On filtre les points valides
  const validTrace = trace.filter(isLatLng);
  const hasTrace = validTrace.length > 0;

  // Centre initial : propriété center > point milieu de la trace > position de Paris par défaut
  const computedCenter: [number, number] =
    center ||
    (hasTrace
      ? (validTrace[Math.floor(validTrace.length / 2)] as [number, number])
      : [48.8584, 2.2945]);

  useEffect(() => {
    dlog(
      `[FlightMap] ${validTrace.length} points | centre=${computedCenter} | zoom=${zoom}`
    );
  }, [validTrace, computedCenter, zoom]);

  useEffect(() => {
    if (flyToTrigger !== undefined && (livePosition || startPosition)) {
      dlog(`[FlightMap] FlyToPosition trigger: recentrage sur`, livePosition || startPosition);
    }
  }, [flyToTrigger, livePosition, startPosition]);

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

      {validTrace.length > 1 && (
        <>
          <Polyline positions={validTrace} pathOptions={polylineOptions} />
          {showMarkers &&
            validTrace.map((pt, i) => (
              <CircleMarker
                key={i}
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

      <FlyToPosition
        position={livePosition || startPosition}
        zoom={zoom}
        flyToTrigger={flyToTrigger}
      />
    </MapContainer>
  );
}
