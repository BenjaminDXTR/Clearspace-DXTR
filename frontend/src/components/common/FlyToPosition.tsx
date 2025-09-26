import { useEffect, useCallback } from "react";
import { useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import { isLatLng } from "../../utils/coords";
import { config } from "../../config";

interface FlyToPositionProps {
  /** Position GPS [latitude, longitude] */
  position?: LatLngTuple | null;
  /** Niveau de zoom lors du déplacement */
  zoom?: number;
  /** Durée de l’animation (en secondes) */
  duration?: number;
  /** Logs console debug (par défaut désactivé en prod) */
  debug?: boolean;
}

/**
 * Composant utilitaire qui centre et anime la carte Leaflet vers la position.
 * Doit être utilisé uniquement dans un <MapContainer>.
 * Ne retourne rien (render null).
 */
export default function FlyToPosition({
  position,
  zoom = 13,
  duration = 1.5,
  debug = config.debug || config.environment === "development",
}: FlyToPositionProps) {
  const map = useMap();

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[FlyToPosition]", ...args);
  }, [debug]);

  useEffect(() => {
    if (isLatLng(position)) {
      dlog(`Animation vers position: (${position![0]}, ${position![1]})`);
      map.flyTo(position!, zoom, { duration });
    } else {
      dlog(`Position invalide ou nulle :`, position);
    }
  }, [position, zoom, duration, map, dlog]);

  return null;
}
