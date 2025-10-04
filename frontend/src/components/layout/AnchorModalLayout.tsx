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
import {
  getFlightTrace,
  stripTimestampFromTrace,
  isLatLng,
} from "../../utils/coords";
import { config } from "../../config";
import "./AnchorModalLayout.css";
import useFlightMapData from "../../hooks/useFlightMapData";


interface AnchorModalLayoutProps {
  anchorModal: AnchorModal | null | undefined;
  anchorDescription: string;
  setAnchorDescription: (description: string) => void;
  getFlightTrace: (flight: Flight) => [number, number, number][];
  isZipping: boolean;
  onValidate: () => void | Promise<void>;
  onCancel: () => void;
  anchorDataPreview: unknown | null;
  debug?: boolean;
  children?: ReactNode;
  mapDivRef: React.MutableRefObject<HTMLDivElement | null>;
}


function getRefCurrent<T>(ref: React.Ref<T>): T | null {
  if (!ref) return null;
  if (typeof ref === "function") {
    // Callback ref, non accessible directement
    return null;
  }
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
  debug = config.debug || config.environment === "development",
  children,
  mapDivRef,
}, ref) => {
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[AnchorModalLayout]", ...args);
  }, [debug]);


  const modalContentRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  const { points: trace, center, zoom } = useFlightMapData(anchorModal?.flight ?? null, 1);
  dlog("[AnchorModal] useFlightMapData renvoie centre, zoom:", center, zoom);


  const hasValidTrace = trace.length > 0 && trace.every(isLatLng);
  const disableValidation = isZipping || !hasValidTrace;
  dlog(`[AnchorModal] disableValidation=${disableValidation}, isZipping=${isZipping}, hasValidTrace=${hasValidTrace}`);


  useEffect(() => {
    if (anchorModal?.flight?.id !== undefined) {
      dlog(`[AnchorModal] Ouverte pour vol id=${anchorModal.flight.id}`);
    }
    if (modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
      dlog("[AnchorModal] Scroll top remis à zéro");
    }
  }, [anchorModal?.flight, dlog]);


  useEffect(() => {
    const current = getRefCurrent(mapDivRef);
    if (current) {
      dlog("[AnchorModalLayout] mapDivRef.current détectée:", current);
    } else {
      dlog("[AnchorModalLayout] mapDivRef.current manquante ou callback ref");
    }
  }, [mapDivRef, mapDivRef?.current]);


  if (!anchorModal?.flight) {
    dlog("[AnchorModal] Aucun vol sélectionné → rien à afficher");
    return null;
  }


  if (!center) {
    dlog("[AnchorModalLayout] Centre non défini encore, affichage d’un chargement");
    return (
      <div className="anchor-modal-overlay" role="alert" aria-live="polite">
        Chargement de la carte...
      </div>
    );
  }


  const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setAnchorDescription(e.target.value);
    dlog(`[AnchorModal] Description modifiée (${e.target.value.length} caractères)`);
  };


  const handleValidate = async () => {
    dlog("[AnchorModal] Validation déclenchée");
    setErrorMsg(null);
    try {
      dlog("[AnchorModal] Appel de onValidate");
      await onValidate();
      dlog("[AnchorModal] onValidate terminé avec succès");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      dlog("[AnchorModal] Erreur lors validation:", e);
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
        <h3 id="anchorModalTitle">Préparation de l&apos;ancrage</h3>
        <div className="anchor-modal-scrollable">
          <div className="left-panel">
            <pre className="anchor-modal-json">
              {anchorDataPreview ? JSON.stringify(anchorDataPreview, null, 2) : "Aucune donnée"}
            </pre>
            <div className="anchor-modal-section">
              <label htmlFor="anchor-description-textarea">
                <b>Description :</b>
              </label>
              <textarea
                id="anchor-description-textarea"
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
          </div>
          <div className="right-panel" id="anchorModalDesc">
            <b>Carte à ancrer :</b>
            <FlightMap
              ref={mapDivRef}
              trace={trace}
              markerIcon={historyIcon}
              showMarkers
              center={center}
              zoom={zoom}
              className="anchor-modal-map modal-map-capture"
              flyToTrigger={1}
            />
            {!hasValidTrace && (
              <div className="anchor-modal-warning" role="alert">
                ⚠️ La trace est vide ou invalide, impossible de valider.
              </div>
            )}
            <div className="anchor-modal-hint">
              Déplacez et zoomez la carte ci-dessus avant de valider.
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
                <span className="spinner" aria-hidden="true" /> Validation...
              </>
            ) : (
              "Valider l'ancrage"
            )}
          </button>
          <button onClick={onCancel} aria-label="Annuler l'ancrage">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
});


AnchorModalLayout.displayName = "AnchorModalLayout";


export default AnchorModalLayout;