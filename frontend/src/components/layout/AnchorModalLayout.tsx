import { useEffect, ChangeEvent } from "react";
import FlightMap from "../common/FlightMap";
import { historyIcon } from "../../utils/icons";
import type { Flight, AnchorModal } from "../../types/models";
import { isLatLng } from "../../utils/coords";
import { config } from "../../config";
import "./AnchorModalLayout.css";

interface AnchorModalLayoutProps {
  anchorModal: AnchorModal | null | undefined;
  anchorDescription: string;
  setAnchorDescription: (description: string) => void;
  getFlightTrace: (flight: Flight) => [number, number][];
  isZipping: boolean;
  onValidate: () => void | Promise<void>;
  onCancel: () => void;
  anchorDataPreview: any | null;
  children?: React.ReactNode; 
  debug?: boolean;
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
}: AnchorModalLayoutProps) {
  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    if (anchorModal?.flight?.id !== undefined) {
      dlog(`[AnchorModal] Ouverte pour vol id=${anchorModal.flight.id}`);
    }
    return () => {
      dlog("[AnchorModal] Fermée");
    };
  }, [anchorModal?.flight]);

  const handleDescriptionChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setAnchorDescription(value);
    dlog(`[AnchorModal] Description modifiée (${value.length} caractères)`);
  };

  const handleValidate = () => {
    dlog("[AnchorModal] Validation déclenchée");
    onValidate();
  };

  if (!anchorModal?.flight) {
    dlog("[AnchorModal] Aucun vol sélectionné → rien à afficher");
    return null;
  }

  const trace = getFlightTrace(anchorModal.flight);
  const hasValidTrace = trace.length > 0 && trace.every(isLatLng);
  const disableValidation = isZipping || !anchorDescription.trim() || !hasValidTrace;

  return (
    <div
      className="anchor-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anchorModalTitle"
      aria-describedby="anchorModalDesc"
    >
      <div className="anchor-modal-content" tabIndex={-1}>
        <h3 id="anchorModalTitle">Préparation de l&apos;ancrage</h3>

        <div className="anchor-modal-scrollable">
          {/* Colonne gauche : JSON & description */}
          <div className="left-panel">
            {/* JSON complet, affiché en entier et lisible */}
            <pre className="anchor-modal-json">
              {anchorDataPreview ? JSON.stringify(anchorDataPreview, null, 2) : "Aucune donnée"}
            </pre>
            {/* Zone commentaire confortable */}
            <div className="anchor-modal-section">
              <label htmlFor="anchor-description-textarea">
                <b>Description :</b>
              </label>
              <textarea
                id="anchor-description-textarea"
                value={anchorDescription}
                onChange={handleDescriptionChange}
                placeholder="Ajouter une description..."
                required
                aria-required="true"
                spellCheck={true}
              />
            </div>
          </div>
          {/* Colonne droite : carte */}
          <div className="right-panel" id="anchorModalDesc">
            <b>Carte à ancrer :</b>
            <FlightMap
              trace={trace}
              markerIcon={historyIcon}
              zoom={10}
              showMarkers
              className="anchor-modal-map modal-map-capture"
            />
            {!hasValidTrace && (
              <div className="anchor-modal-warning">
                ⚠️ La trace est vide ou invalide, impossible de valider.
              </div>
            )}
            <div className="anchor-modal-hint">
              Déplacez et zoomez la carte ci-dessus avant de valider.
            </div>
          </div>
        </div>

        {/* Footer - boutons */}
        <div className="anchor-modal-actions">
          <button
            disabled={disableValidation}
            onClick={handleValidate}
            aria-busy={isZipping}
            aria-label="Valider l'ancrage"
          >
            {isZipping ? "Validation..." : "Valider l'ancrage"}
          </button>
          <button onClick={onCancel} aria-label="Annuler l'ancrage">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
