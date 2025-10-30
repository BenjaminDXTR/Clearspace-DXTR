// src/components/common/FlightMarkers.tsx
import React from "react";
import { Polyline, CircleMarker, Marker, Popup } from "react-leaflet";
import type { LatLngExpression, Icon, PathOptions } from "leaflet";
import { droneIcon, historyIcon } from "../../utils/icons";

interface FlightMarkersProps {
  trace: LatLngExpression[];
  showMarkers: boolean;
  markerIcon?: Icon | null;
  startPosition?: LatLngExpression | null;
  livePosition?: LatLngExpression | null;
  polylineOptions?: PathOptions;
  circleMarkerRadius?: number;
  circleMarkerFillColor?: string;
  circleMarkerColor?: string;
}

export default function FlightMarkers({
  trace,
  showMarkers,
  markerIcon = null,
  startPosition,
  livePosition,
  polylineOptions = { color: "#c00", weight: 2 },
  circleMarkerRadius = 4,
  circleMarkerFillColor = "#1976d2",
  circleMarkerColor = "#fff",
}: FlightMarkersProps) {
  return (
    <>
      {(trace.length > 1) && (
        <>
          <Polyline positions={trace} pathOptions={polylineOptions} />
          {showMarkers &&
            trace.map((pt, i) => (
              <CircleMarker
                key={`circle-${i}`}
                center={pt}
                radius={circleMarkerRadius}
                fillColor={circleMarkerFillColor}
                color={circleMarkerColor}
                weight={1}
                fillOpacity={0.9}
              />
            ))}
        </>
      )}

      {(trace.length === 1) && (
        <>
          {showMarkers && (
            <CircleMarker
              center={trace[0]}
              radius={circleMarkerRadius}
              fillColor={circleMarkerFillColor}
              color={circleMarkerColor}
              weight={1}
              fillOpacity={0.9}
            />
          )}
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
      {markerIcon && trace.length > 0 && !livePosition && (
        <Marker position={trace[trace.length - 1]} icon={markerIcon} />
      )}
    </>
  );
}
