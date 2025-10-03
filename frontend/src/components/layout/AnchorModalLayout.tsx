// src/components/layout/AnchorModalLayout.tsx
import {
  useEffect,
  ChangeEvent,
  useCallback,
  useRef,
  useState,
  ReactNode,
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
}

export default function AnchorModalLayout({
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
}: AnchorModalLayoutProps) {
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[AnchorModalLayout]", ...args);
  }, [debug]);

  const modalContentRef = useRef<HTMLDivElement>(null);
  const mapDivRef = useRef<HTMLElement | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation();
    setAnchorDescription(e.target.value);
    dlog(`[AnchorModal] Description modifiée (${e.target.value.length} caractères)`);
  };

  const handleValidate = async () => {
    dlog("[AnchorModal] Validation déclenchée");
    setErrorMsg(null);
    try {
      await onValidate();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      dlog("[AnchorModal] Erreur lors validation:", e);
      setErrorMsg(message);
    }
  };

  if (!anchorModal?.flight) {
    dlog("[AnchorModal] Aucun vol sélectionné → rien à afficher");
    return null;
  }

  const fullTrace = getFlightTrace(anchorModal.flight);
  const trace = stripTimestampFromTrace(fullTrace);
  const hasValidTrace = trace.length > 0 && trace.every(isLatLng);
  const disableValidation = isZipping || !hasValidTrace;

  useEffect(() => {
    if (anchorModal?.flight?.id !== undefined) {
      dlog(`[AnchorModal] Ouverte pour vol id=${anchorModal.flight.id}`);
    }
    if (modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [anchorModal?.flight, dlog]);

  return (
    <div
      className="anchor-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anchorModalTitle"
      aria-describedby="anchorModalDesc"
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
              key={anchorModal.flight.id + "-" + trace.length}
              ref={mapDivRef}
              trace={trace}
              markerIcon={historyIcon}
              showMarkers
              fitToTrace={true}
              className="anchor-modal-map modal-map-capture"
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
}
