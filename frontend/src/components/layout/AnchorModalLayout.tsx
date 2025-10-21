import {
  useEffect,
  ChangeEvent,
  useCallback,
  useRef,
  useState,
  ReactNode,
  forwardRef,
} from "react";
import FlightMap from "../common/FlightMap";
import { historyIcon } from "../../utils/icons";
import type { Flight, AnchorModal } from "../../types/models";
import { getFlightTrace, isLatLng } from "../../utils/coords";
import { config } from "../../config";
import "./AnchorModalLayout.css";
import useFlightData from "../../hooks/useFlightMapData";

interface AnchorModalLayoutProps {
  anchorModal: AnchorModal | null | undefined;
  anchorDescription: string;
  setAnchorDescription: (description: string) => void;
  getFlightTrace: (flight: Flight) => [number, number, number][];
  isZipping: boolean;
  onValidate: () => void | Promise<void>;
  onCancel: () => void;
  anchorDataPreview: unknown | null;
  message?: string | null; // Nouveau champ message
  debug?: boolean;
  children?: ReactNode;
  mapDivRef: React.RefObject<HTMLDivElement>;
  mapReady: boolean;
  setMapReady: (ready: boolean) => void;
  setMapContainer?: (container: HTMLElement | null) => void;
}

function getRefCurrent<T>(ref: React.RefObject<T>): T | null {
  return ref.current ?? null;
}

const AnchorModalLayout = forwardRef<HTMLDivElement, AnchorModalLayoutProps>(({
  anchorModal,
  anchorDescription,
  setAnchorDescription,
  getFlightTrace,
  isZipping,
  onValidate,
  onCancel,
  anchorDataPreview,
  message = null, // message par défaut
  debug = config.debug || config.environment === "development",
  children,
  mapDivRef,
  mapReady,
  setMapReady,
  setMapContainer,
}, ref) => {
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[AnchorModal]", ...args);
  }, [debug]);

  const modalContentRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ajout du trigger dynamique pour le flyTo
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const { points: trace, center: rawCenter, zoom: rawZoom } = useFlightData(anchorModal?.flight ?? null, flyToTrigger);
  const center = rawCenter ?? [48.8584, 2.2945];
  const zoom = rawZoom ?? 13;

  const hasValidTrace = trace.length > 0 && trace.every(isLatLng);
  const disableValidation = isZipping || !hasValidTrace || !mapReady;

  useEffect(() => {
    if (anchorModal?.flight) {
      dlog("Opening modal for flight", anchorModal.flight.id);
      if (modalContentRef.current) {
        modalContentRef.current.scrollTop = 0;
        dlog("Scrolled modal to top");
      }
      setMapReady(false);

      // Incrémenter flyToTrigger pour forcer le recentrage à chaque ouverture
      setFlyToTrigger(ft => ft + 1);
    }
  }, [anchorModal, dlog, setMapReady]);

  useEffect(() => {
    const current = getRefCurrent(mapDivRef);
    if (current) {
      dlog("mapDivRef current:", current, "dimensions:", current.offsetWidth, current.offsetHeight);
    } else {
      dlog("mapDivRef current is null or not stable");
    }
  }, [mapDivRef]);

  if (!anchorModal?.flight) {
    dlog("No flight selected, nothing to display");
    return null;
  }

  if (!center) {
    dlog("Center not defined, showing loading");
    return (
      <div className="anchor-modal-overlay" role="alert" aria-live="polite">
        Chargement...
      </div>
    );
  }

  const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setAnchorDescription(e.target.value);
    dlog("Description changed", e.target.value.length);
  };

  const handleValidate = async () => {
    dlog("Validate clicked");
    setErrorMsg(null);
    if (!mapReady) {
      setErrorMsg("La carte n'est pas encore prête à la capture.");
      return;
    }
    try {
      await new Promise(res => setTimeout(res, 800));
      await onValidate();
      dlog("Validate finished without error");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      dlog("Validate error:", error);
      setErrorMsg(message);
    }
  };

  return (
    <div
      className="anchor-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anchorModalTitle"
      aria-describedby="anchorModalDesc"
      ref={ref}
    >
      <div className="anchor-modal-content" tabIndex={-1} ref={modalContentRef}>
        <h3 id="anchorModalTitle">Préparation de l'ancrage</h3>
        <div className="anchor-modal-scrollable">
          <div className="left-panel">
            <pre className="anchor-modal-json">
              {anchorDataPreview ? JSON.stringify(anchorDataPreview, null, 2) : "Pas de données"}
            </pre>
            <div className="anchor-modal-section">
              <label htmlFor="anchorDescription">Description :</label>
              <textarea
                id="anchorDescription"
                value={anchorDescription}
                onChange={handleDescriptionChange}
                placeholder="Ajouter une description..."
                spellCheck
              />
            </div>
            {errorMsg && (
              <div className="anchor-modal-error" role="alert">
                ⚠️ {errorMsg}
              </div>
            )}
            {message && (
              <div className="anchor-modal-message" role="alert" aria-live="polite">
                {message}
              </div>
            )}
          </div>
          <div className="right-panel" id="anchorModalDesc">
            <div>Carte à ancrer :</div>
            <FlightMap
              ref={mapDivRef}
              trace={trace}
              startPosition={trace.length > 0 ? trace[0] : null}          // Premier point de la trace = départ
              livePosition={trace.length > 1 ? trace[trace.length - 1] : null} // Dernier point = position actuelle/fin
              showMarkers={true}
              center={center}
              zoom={zoom}
              className="modal-map-capture"
              flyToTrigger={flyToTrigger}
              onMapReady={(container) => {
                dlog("Carte prête et stable", container);
                setMapReady(true);
                if (setMapContainer) {
                  setMapContainer(container);
                }
              }}
            />
            {!hasValidTrace && (
              <div className="anchor-modal-warning" role="alert">
                ⚠️ Trace vide ou invalide, impossible de valider.
              </div>
            )}
            <div className="anchor-modal-hint">
              Déplacez et zoomez la carte avant validation.
            </div>
          </div>
        </div>
        {children}
        <div className="anchor-modal-actions">
          <button
            disabled={disableValidation}
            onClick={handleValidate}
            aria-busy={isZipping}
            aria-label="Valider l'ancrage"
          >
            {isZipping ? (
              <>
                <span className="spinner" aria-hidden="true" /> Traitement...
              </>
            ) : (
              "Valider"
            )}
          </button>
          <button onClick={onCancel} aria-label="Annuler">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
});

AnchorModalLayout.displayName = "AnchorModalLayout";

export default AnchorModalLayout;
