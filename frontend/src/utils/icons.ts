import L from "leaflet";
import { config } from "../config";

/**
 * URLs des icônes provenant de la configuration centrale.
 * Ces URLs doivent pointer vers des images valides pour les icônes Leaflet.
 */
const ICON_URLS = config.iconUrls;

/**
 * Taille par défaut pour les icônes.
 * Typée comme tuple [width, height] explicitement pour TypeScript.
 */
const DEFAULT_ICON_SIZE = config.defaultIconSize as [number, number];

/**
 * Taille spécifique pour les icônes d'historique.
 * Typée comme tuple [width, height] explicitement pour TypeScript.
 */
const HISTORY_ICON_SIZE = config.historyIconSize as [number, number];

/**
 * Crée une icône Leaflet avec des paramètres communs.
 * - iconUrl : URL de l'image de l'icône.
 * - size : dimensions de l'icône (largeur, hauteur).
 * - className : classe CSS personnalisée pour le style de l'icône.
 */
function createIcon(
  iconUrl: string,
  size: [number, number] = DEFAULT_ICON_SIZE,
  className = "leaflet-default-icon"
): L.Icon {
  return new L.Icon({
    iconUrl,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]], // Ancre centrée horizontalement et au bas verticalement
    popupAnchor: [0, -size[1]],         // Popup positionné au-dessus de l'icône
    className,
  });
}

/**
 * Icône pour drone en direct (position actuelle).
 */
export const droneIcon = createIcon(ICON_URLS.droneLive, DEFAULT_ICON_SIZE, "leaflet-drone-icon");

/**
 * Icône pour vol historique (position de départ).
 * Icône généralement plus petite pour différenciation visuelle claire.
 */
export const historyIcon = createIcon(ICON_URLS.droneStart, HISTORY_ICON_SIZE, "leaflet-history-icon");
