import L from "leaflet";
import { config } from "../config";

// Chemins vers les icônes (toujours pris dans la config centrale)
const ICON_URLS = config.iconUrls;

// Tailles fixées localement dans le module utils/icons
const DEFAULT_ICON_SIZE: [number, number] = [36, 36];     // Drone live
const HISTORY_ICON_SIZE: [number, number] = [28, 28];     // Point de départ

function createIcon(
  iconUrl: string,
  size: [number, number],
  className = "leaflet-default-icon"
): L.Icon {
  return new L.Icon({
    iconUrl,
    iconSize: size,
    // Ancre centrée horizontalement ET verticalement
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -size[1] / 2],
    className,
  });
}

export const droneIcon = createIcon(
  ICON_URLS.droneLive,
  DEFAULT_ICON_SIZE,
  "leaflet-drone-icon"
);

export const historyIcon = createIcon(
  ICON_URLS.droneStart,
  HISTORY_ICON_SIZE,
  "leaflet-history-icon"
);
