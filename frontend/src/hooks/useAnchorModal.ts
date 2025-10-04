import React, { useState, useCallback, useRef, useEffect } from "react";
import type { AnchorModal, Flight, HandleSelectFn, LatLng } from "../types/models";
import { buildAnchorData, generateAnchorZip, sendAnchorToBackend } from "../services/anchorService";
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
  mapDivRef: React.MutableRefObject<HTMLElement | null>;
}


interface UseAnchorModalOptions {
  handleSelect?: HandleSelectFn;
  debug?: boolean;
}


function getRefCurrent(ref: React.Ref<HTMLElement | null>): HTMLElement | null {
  if (!ref) return null;
  if (typeof ref === "function") {
    return null;
  }
  return ref.current ?? null;
}


function waitForStableRef(
  ref: React.RefObject<HTMLElement>,
  timeoutMs = 7000,
  stableDelayMs = 200
): Promise<void> {
  return new Promise((resolve, reject) => {
    let elapsed = 0;
    let lastPresence = 0;


    const interval = 50;
    const check = () => {
      if (ref.current) {
        if (lastPresence === 0) lastPresence = elapsed;
        else if (elapsed - lastPresence >= stableDelayMs) {
          resolve();
          return;
        }
      } else {
        lastPresence = 0; // Reset if ref disappears
      }


      elapsed += interval;
      if (elapsed >= timeoutMs) reject(new Error("Timeout waiting for stable ref"));
      else setTimeout(check, interval);
    };


    check();
  });
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
  const mapDivRef = useRef<HTMLElement | null>(null);


  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useAnchorModal]", ...args);
  }, [debug]);


  const convertTrace = useCallback(
    (trace: LatLng[], altitude: number) =>
      trace.map(([lat, lng]) => ({ latitude: lat, longitude: lng, altitude })),
    []
  );


  const openModal = useCallback((flight: Flight, trace: LatLng[] = []) => {
    dlog("Ouverture modal pour vol :", flight.id);
    traceRef.current = trace;
    setAnchorModal({ flight });
    setAnchorDescription("");
    if (handleSelect) {
      dlog("Appel de handleSelect avec vol id:", flight.id);
      handleSelect({ ...flight, _type: "local" });
    }
    const traceConverted = convertTrace(trace, flight.altitude ?? 0);
    setAnchorDataPreview(buildAnchorData(flight, "", traceConverted));
  }, [convertTrace, dlog, handleSelect]);


  useEffect(() => {
    if (!anchorModal?.flight) return;
    const traceConverted = convertTrace(traceRef.current, anchorModal.flight.altitude ?? 0);
    const newAnchorData = buildAnchorData(anchorModal.flight, anchorDescription, traceConverted);
    dlog("Mise à jour des données d’ancrage avec description:", anchorDescription);
    setAnchorDataPreview(newAnchorData);
  }, [anchorDescription, anchorModal, convertTrace, dlog]);


  const onCancel = useCallback(() => {
    dlog("Fermeture du modal");
    setAnchorModal(null);
    setAnchorDescription("");
    traceRef.current = [];
    setAnchorDataPreview(null);
  }, [dlog]);


  const captureMap = useCallback(async (): Promise<Blob> => {
    dlog("Attente ref stable pour capture");
    await waitForStableRef(mapDivRef, 7000, 300);
    await new Promise(res => setTimeout(res, 300)); // Temps supplémentaire avant capture
    const currentRef = mapDivRef.current;
    if (!currentRef) throw new Error("Ref non disponible au moment de la capture");
    dlog("Capture du container prête", currentRef);
    if (!currentRef) {
      dlog("Erreur captureMap: Ref carte toujours manquante après attente");
      throw new Error("Carte non trouvée pour la capture d'ancrage");
    }
    dlog("captureMap: ref carte trouvée :", currentRef);
    dlog("Début capture html2canvas...");
    const canvas = await html2canvas(currentRef, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#fff",
      scale: 2,
      logging: false,
    } as any);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          dlog(blob ? "Capture réalisée avec succès." : "Capture échouée.");
          blob ? resolve(blob) : reject(new Error("Impossible de capturer la carte"));
        },
        "image/png",
        1.0
      );
    });
  }, [dlog, mapDivRef]);


  const onValidate = useCallback(async () => {
    if (!anchorModal) {
      dlog("Validation ignorée, aucun modal actif.");
      return;
    }
    setIsZipping(true);
    dlog("Début validation pour vol id:", anchorModal.flight.id);
    try {
      await new Promise(resolve => setTimeout(resolve, 600)); // délai pour attendre animations/rendus éventuels
      dlog("Lancement capture de la carte...");
      const mapImageBlob = await captureMap();
      dlog("Construction des données JSON d'ancrage...");
      const traceConverted = convertTrace(traceRef.current, anchorModal.flight.altitude ?? 0);
      const anchorData = buildAnchorData(anchorModal.flight, anchorDescription, traceConverted);
      dlog("Création du ZIP avec image et positions...");
      const zipBlob = await generateAnchorZip(mapImageBlob, traceConverted);
      dlog("Envoi des données au backend...");
      await sendAnchorToBackend(anchorData, zipBlob);
      dlog("Ancrage signalé avec succès.");
      if (handleSelect) {
        dlog("Mise à jour sélection vol ancré via handleSelect.");
        handleSelect({ ...anchorModal.flight, _type: "local" });
      }
      onCancel();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      dlog("[useAnchorModal] Erreur lors de la validation:", e);
      alert("Erreur lors de l'ancrage : " + message);
    } finally {
      setIsZipping(false);
    }
  }, [anchorModal, anchorDescription, captureMap, convertTrace, dlog, handleSelect, onCancel]);


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
    mapDivRef,
  };
}