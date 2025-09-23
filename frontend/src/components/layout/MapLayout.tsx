import { useEffect, useMemo } from "react";
import FlightMap from "../common/FlightMap";
import DetailsPanel from "../flights/DetailsPanel";
import { isLatLng, getFlightTrace } from "../../utils/coords";
import type { Flight, LatLng } from "../../types/models";
import { config } from "../../config";
import "./MapLayout.css";

interface MapLayoutProps {
  /** Points de trace déjà fournis (optionnel, si déjà calculés plus haut) */
  selectedTracePoints?: LatLng[] | null;
  /** Données brutes de trace (optionnel) */
  selectedTraceRaw?: any;
  /** Vol actuellement sélectionné */
  selected?: Flight | null;
  /** Champs à afficher dans le panneau de détails */
  detailFields?: string[];
  /** Fonction utilisée pour exporter en JSON depuis le panneau Détails */
  exportObj: (obj: Flight) => void;
  /** Active les logs console si en mode debug */
  debug?: boolean;
  /** Titre qui s’affiche au-dessus de la carte */
  title?: string;
  /** Déclencheur pour forcer le centrage de la carte même si le vol est identique */
  flyToTrigger?: number;
}

/**
 * Composant principal qui :
 * - Extrait et nettoie la trace du vol sélectionné
 * - Calcule les positions importantes (départ et actuelle)
 * - Passe ces infos à FlightMap pour affichage
 * - Affiche à droite le panneau de détails si un vol est sélectionné
 */
export default function MapLayout({
  selectedTracePoints,
  selectedTraceRaw,
  selected,
  detailFields,
  exportObj,
  debug = config.debug || config.environment === "development",
  title = "Carte des détections",
  flyToTrigger,
}: MapLayoutProps) {
  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  /** Log à chaque changement de vol sélectionné */
  useEffect(() => {
    if (selected) {
      dlog(
        `[MapLayout] vol id=${selected.id ?? "N/A"} - ${selectedTracePoints?.length ?? 0} point(s)`
      );
    } else {
      dlog("[MapLayout] sans sélection");
    }
  }, [selected, selectedTracePoints]);

  /**
   * Trace GPS :
   * 1. Si un vol est sélectionné → on récupère sa trace avec getFlightTrace()
   * 2. Sinon → on utilise la prop selectedTracePoints (si fournie)
   */
  const points: LatLng[] = useMemo(() => {
    if (selected) {
      return getFlightTrace(selected).filter(isLatLng);
    }
    if (!Array.isArray(selectedTracePoints)) return [];
    return selectedTracePoints.filter(isLatLng);
  }, [selectedTracePoints, selected]);

  const hasValidPoints = points.length > 0;

  /** Premier point = position de départ */
  const startPosition: LatLng | null = hasValidPoints ? points[0] : null;
  /** Dernier point = position actuelle */
  const livePosition: LatLng | null = hasValidPoints ? points[points.length - 1] : null;

  return (
    <div className="map-layout">
      {/* Zone Carte */}
      <div className="map-layout__map">
        <h2 className="map-layout__title">{title}</h2>
        <FlightMap
          trace={points}               // Ensemble de la trace GPS
          markerIcon={null}            // Pas de marqueur automatique, on gère nous-mêmes
          livePosition={livePosition}  // Marqueur position actuelle
          startPosition={startPosition} // Marqueur point de départ
          zoom={10}
          showMarkers={false}          // Désactiver les marqueurs intermédiaires
          className="map-layout__leaflet"
          aria-label={`Carte ${hasValidPoints ? "avec" : "sans"} trace sélectionnée`}
          flyToTrigger={flyToTrigger}  // Sert à recentrer même si vol inchangé
        />
      </div>

      {/* Zone Panneau Détails */}
      <div className="map-layout__details">
        {selected ? (
          <DetailsPanel
            selected={selected}
            detailFields={detailFields}
            exportObj={exportObj}
            selectedTraceRaw={selectedTraceRaw}
            selectedTracePoints={points}
          />
        ) : (
          <div className="map-layout__no-selection">
            Sélectionnez un vol pour voir les détails
          </div>
        )}
      </div>
    </div>
  );
}
