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
  /** Trigger pour savoir quand déclencher le flyTo */
  flyToTrigger?: number;
}

export default function FlyToPosition({
  position,
  zoom = 13,
  duration = 1.5,
  debug = config.debug || config.environment === "development",
  flyToTrigger,
}: FlyToPositionProps) {
  const map = useMap();

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[FlyToPosition]", ...args);
  }, [debug]);

  useEffect(() => {
    dlog(`useEffect triggered with flyToTrigger=${flyToTrigger}`);

    if (flyToTrigger === undefined) {
      dlog("flyToTrigger is undefined, skipping flyTo animation");
      return;
    }

    if (!isLatLng(position)) {
      dlog("Invalid position, skipping flyTo animation", position);
      return;
    }

    const timer = setTimeout(() => {
      map.flyTo(position!, zoom, { duration });
      dlog("map.flyTo called");
    }, 50);

    return () => clearTimeout(timer);
  }, [flyToTrigger]); // <- uniquement flyToTrigger comme dépendance

  return null;
}
