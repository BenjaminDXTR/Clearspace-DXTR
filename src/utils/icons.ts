import L from "leaflet";

/**
 * URLs des icônes (peuvent être locales dans ton dossier public ou CDN)
 */
export const ICON_URLS = {
  droneLive: "https://cdn-icons-png.flaticon.com/512/854/854878.png",
  droneStart: "https://cdn-icons-png.flaticon.com/512/3448/3448339.png",
};

/**
 * Taille par défaut des icônes
 */
export const DEFAULT_ICON_SIZE: [number, number] = [36, 36];

/**
 * Crée une icône Leaflet avec paramètres communs
 */
function createIcon(iconUrl: string, size: [number, number] = DEFAULT_ICON_SIZE, className = "leaflet-default-icon"): L.Icon {
  return new L.Icon({
    iconUrl,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]], // centre bas
    popupAnchor: [0, -size[1]],         // popup au-dessus de l'icône
    className,
  });
}

/**
 * Icône pour drone en live (position actuelle)
 */
export const droneIcon = createIcon(ICON_URLS.droneLive, [36, 36], "leaflet-drone-icon");

/**
 * Icône pour vol historique (position départ)
 * Plus petite pour bien distinguer visuellement
 */
export const historyIcon = createIcon(ICON_URLS.droneStart, [28, 28], "leaflet-history-icon");
