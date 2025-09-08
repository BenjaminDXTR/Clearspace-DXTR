import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import { isLatLng } from "../../utils/coords";

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
 * Composant utilitaire qui déplace/centre la carte Leaflet vers une position donnée.
 * - À utiliser à l'intérieur d'un <MapContainer/>
 * - N'affiche rien (return null)
 */
export default function FlyToPosition({
  position,
  zoom = 1,
  duration = 20,
  debug = process.env.NODE_ENV === "development",
}: FlyToPositionProps) {
  const map = useMap();

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    if (isLatLng(position)) {
      dlog(`[FlyToPosition] Déplacement animé vers (${position[0]}, ${position[1]})`);
      map.flyTo(position, zoom, { duration });
    } else {
      if (debug) console.warn(`[FlyToPosition] Position invalide ou vide :`, position);
    }
  }, [position, zoom, duration, map]);

  return null;
}
