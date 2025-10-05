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
  /** Durée de l'animation */
  duration?: number;
  /** Logs console debug (default off in prod) */
  debug?: boolean;
  /** Trigger pour démarrer le flyTo */
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
      dlog("flyToTrigger is undefined, skipping flyTo");
      return;
    }
    if (!isLatLng(position)) {
      dlog("Invalid position, skipping flyTo", position);
      return;
    }

    const timer = setTimeout(() => {
      dlog(`Executing flyTo at position=${JSON.stringify(position)} zoom=${zoom} duration=${duration}`);
      map.flyTo(position!, zoom, { duration });
    }, 50);

    return () => {
      dlog("Clearing flyTo timeout");
      clearTimeout(timer);
    };
  }, [flyToTrigger]);  // seul flyToTrigger déclenche l'effet, évitant les reruns inutiles

  return null;
}
