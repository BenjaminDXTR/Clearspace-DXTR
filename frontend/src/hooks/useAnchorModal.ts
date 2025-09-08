import { useState, useCallback, useRef, useEffect } from "react";
import type { AnchorModal, Flight, HandleSelectFn, LatLng } from "../types/models";
import {
  buildAnchorData,
  generateAnchorZip,
  sendAnchorToBackend,
} from "../services/anchorService";
import html2canvas from "html2canvas";

interface UseAnchorModalResult {
  anchorModal: AnchorModal | null;
  anchorDescription: string;
  isZipping: boolean;
  setAnchorModal: (modal: AnchorModal | null) => void;
  setAnchorDescription: (desc: string) => void;
  onValidate: () => Promise<void>;
  onCancel: () => void;
  openModal: (flight: Flight, trace?: LatLng[]) => void;
  anchorDataPreview: any | null;
}

interface UseAnchorModalOptions {
  handleSelect?: HandleSelectFn;
  debug?: boolean;
}

export default function useAnchorModal({
  handleSelect,
  debug = process.env.NODE_ENV === "development",
}: UseAnchorModalOptions = {}): UseAnchorModalResult {
  const [anchorModal, setAnchorModal] = useState<AnchorModal | null>(null);
  const [anchorDescription, setAnchorDescription] = useState("");
  const [isZipping, setIsZipping] = useState(false);

  // Stocke la trace complète associée au vol en cours d’ancrage
  const traceRef = useRef<LatLng[]>([]);

  // Stocke le JSON d’ancrage construit pour affichage en temps réel
  const [anchorDataPreview, setAnchorDataPreview] = useState<any | null>(null);

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  /**
   * Ouvre la modale avec vol et trace.
   * Construit aussi le JSON d’ancrage initial.
   */
  const openModal = useCallback(
    (flight: Flight, trace: LatLng[] = []) => {
      dlog("[useAnchorModal] Ouverture modal pour vol :", flight.id);
      traceRef.current = trace;
      setAnchorModal({ flight });
      setAnchorDescription("");

      // Construire anchorData avec description vide
      const traceConverted = trace.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
        altitude: flight.altitude ?? 0,
      }));
      setAnchorDataPreview(buildAnchorData(flight, "", traceConverted));

      if (handleSelect) {
        handleSelect({ ...flight, _type: "local" });
      }
    },
    [handleSelect]
  );

  /**
   * Met à jour l’aperçu JSON d’ancrage à chaque changement de description ou vol
   */
  useEffect(() => {
    if (anchorModal?.flight) {
      const traceConverted = traceRef.current.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
        altitude: anchorModal.flight.altitude ?? 0,
      }));
      const newAnchorData = buildAnchorData(anchorModal.flight, anchorDescription, traceConverted);
      setAnchorDataPreview(newAnchorData);
    }
  }, [anchorDescription, anchorModal]);

  const onCancel = useCallback(() => {
    dlog("[useAnchorModal] Fermeture du modal");
    setAnchorModal(null);
    setAnchorDescription("");
    traceRef.current = [];
    setAnchorDataPreview(null);
  }, []);

  const captureMap = useCallback(async (): Promise<Blob> => {
    const mapDiv = document.querySelector(
      ".modal-map-capture .leaflet-container"
    ) as HTMLElement | null;

    if (!mapDiv) {
      throw new Error("Carte non trouvée pour la capture d'ancrage");
    }

    const canvas = await html2canvas(mapDiv, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#fff",
      scale: 2,
      logging: false,
    } as any);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Impossible de capturer la carte"))),
        "image/png",
        1.0
      );
    });
  }, []);

  const onValidate = useCallback(async () => {
    if (!anchorModal) return;
    setIsZipping(true);

    try {
      dlog("[useAnchorModal] Validation en cours pour vol :", anchorModal.flight.id);
      await new Promise((r) => setTimeout(r, 600));

      dlog("[useAnchorModal] Capture de la carte...");
      const mapImageBlob = await captureMap();

      dlog("[useAnchorModal] Construction des données JSON d'ancrage...");
      const traceConverted = traceRef.current.map(([lat, lng]) => ({
        latitude: lat,
        longitude: lng,
        altitude: anchorModal.flight.altitude ?? 0,
      }));
      const anchorData = buildAnchorData(anchorModal.flight, anchorDescription, traceConverted);

      dlog("[useAnchorModal] Création du ZIP (image + positions)...");
      const zipBlob = await generateAnchorZip(mapImageBlob, traceConverted);

      dlog("[useAnchorModal] Envoi des données au backend...");
      await sendAnchorToBackend(anchorData, zipBlob);

      if (handleSelect) {
        dlog("[useAnchorModal] Mise à jour sélection vol ancré");
        handleSelect({ ...anchorModal.flight, _type: "local" });
      }

      dlog("[useAnchorModal] Ancrage terminé avec succès");
      setAnchorModal(null);
      setAnchorDescription("");
      traceRef.current = [];
      setAnchorDataPreview(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      if (debug) console.error("[useAnchorModal] Erreur:", e);
      alert("Erreur lors de l'ancrage : " + message);
    } finally {
      setIsZipping(false);
    }
  }, [anchorModal, anchorDescription, captureMap, handleSelect, debug]);

  return {
    anchorModal,
    anchorDescription,
    isZipping,
    setAnchorModal,
    setAnchorDescription,
    onValidate,
    onCancel,
    openModal,
    anchorDataPreview,
  };
}
