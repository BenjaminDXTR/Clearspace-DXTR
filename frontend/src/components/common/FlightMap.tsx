import { useRef, useEffect, useCallback, CSSProperties } from "react";
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


/** Hook : force Leaflet à recalculer sa taille */
function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}


/**
 * Centre et anime la carte vers une position à chaque changement de flyToTrigger.
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
  }, [flyToTrigger, position, zoom, map]);

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

  // Filtrage des points valides
  const validTrace = trace.filter(isLatLng);
  const hasTrace = validTrace.length > 0;

  // Centre initial de la carte : centre passé en props > milieu trace > position Paris par défaut
  const computedCenter: [number, number] =
    center ??
    (hasTrace
      ? (validTrace[Math.floor(validTrace.length / 2)] as [number, number])
      : [48.8584, 2.2945]);

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

      <FlyToPosition
        position={livePosition ?? startPosition}
        zoom={zoom}
        flyToTrigger={flyToTrigger}
      />
    </MapContainer>
  );
}
