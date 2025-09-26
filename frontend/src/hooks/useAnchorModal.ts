import { useState, useCallback, useRef, useEffect } from "react";
import type { AnchorModal, Flight, HandleSelectFn, LatLng } from "../types/models";
import {
  buildAnchorData,
  generateAnchorZip,
  sendAnchorToBackend,
} from "../services/anchorService";
import html2canvas from "html2canvas";
import { config } from "../config";

interface UseAnchorModalResult {
  anchorModal: AnchorModal | null;
  anchorDescription: string;
  isZipping: boolean;
  setAnchorModal: (modal: AnchorModal | null) => void;
  setAnchorDescription: (desc: string) => void;
  onValidate: () => Promise<void>;
  onCancel: () => void;
  openModal: (flight: Flight, trace?: LatLng[]) => void;
  anchorDataPreview: ReturnType<typeof buildAnchorData> | null;
}

interface UseAnchorModalOptions {
  handleSelect?: HandleSelectFn;
  debug?: boolean;
}

export default function useAnchorModal({
  handleSelect,
  debug = config.debug || config.environment === "development",
}: UseAnchorModalOptions = {}): UseAnchorModalResult {
  const [anchorModal, setAnchorModal] = useState<AnchorModal | null>(null);
  const [anchorDescription, setAnchorDescription] = useState("");
  const [isZipping, setIsZipping] = useState(false);
  const [anchorDataPreview, setAnchorDataPreview] = useState<ReturnType<typeof buildAnchorData> | null>(null);

  const traceRef = useRef<LatLng[]>([]);

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useAnchorModal]", ...args);
  }, [debug]);

  // Helper to convert trace points with altitude
  const convertTrace = useCallback((trace: LatLng[], altitude: number) => {
    return trace.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
      altitude,
    }));
  }, []);

  const openModal = useCallback((flight: Flight, trace: LatLng[] = []) => {
    dlog("Ouverture modal pour vol :", flight.id);
    traceRef.current = trace;
    setAnchorModal({ flight });
    setAnchorDescription("");

    const traceConverted = convertTrace(trace, flight.altitude ?? 0);
    setAnchorDataPreview(buildAnchorData(flight, "", traceConverted));

    if (handleSelect) {
      handleSelect({ ...flight, _type: "local" });
    }
  }, [convertTrace, dlog, handleSelect]);

  useEffect(() => {
    if (!anchorModal?.flight) return;

    const traceConverted = convertTrace(traceRef.current, anchorModal.flight.altitude ?? 0);
    const newAnchorData = buildAnchorData(anchorModal.flight, anchorDescription, traceConverted);
    setAnchorDataPreview(newAnchorData);
  }, [anchorDescription, anchorModal, convertTrace]);

  const onCancel = useCallback(() => {
    dlog("Fermeture du modal");
    setAnchorModal(null);
    setAnchorDescription("");
    traceRef.current = [];
    setAnchorDataPreview(null);
  }, [dlog]);

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
      dlog("Validation pour vol :", anchorModal.flight.id);
      // Petit délai pour UX
      await new Promise(r => setTimeout(r, 600));

      dlog("Capture de la carte...");
      const mapImageBlob = await captureMap();

      dlog("Construction données JSON d'ancrage...");
      const traceConverted = convertTrace(traceRef.current, anchorModal.flight.altitude ?? 0);
      const anchorData = buildAnchorData(anchorModal.flight, anchorDescription, traceConverted);

      dlog("Création ZIP (image + positions)...");
      const zipBlob = await generateAnchorZip(mapImageBlob, traceConverted);

      dlog("Envoi des données au backend...");
      await sendAnchorToBackend(anchorData, zipBlob);

      if (handleSelect) {
        dlog("Mise à jour sélection vol ancré");
        handleSelect({ ...anchorModal.flight, _type: "local" });
      }

      dlog("Ancrage terminé avec succès");
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
  }, [anchorModal, anchorDescription, captureMap, convertTrace, dlog, handleSelect, debug]);

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
