import React, { useState, useCallback, useRef, useEffect } from "react";
import type { AnchorModal, Flight, HandleSelectFn, LatLngTimestamp } from "../types/models";
import {
  buildAnchorDataPrincipal,
  buildRawData,
  generateZipFromDataWithProof,
} from "../services/anchorService";
import html2canvas from "html2canvas";
import { config } from "../config";

interface UseAnchorModal {
  anchorModal: AnchorModal | null;
  anchorDescription: string;
  isZipping: boolean;
  mapReady: boolean;
  message: string | null;
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setAnchorDescription: (desc: string) => void;
  setAnchorModal: (modal: AnchorModal | null) => void;
  setMapContainer: (container: HTMLElement | null) => void;
  setMapReady: (ready: boolean) => void;
  onValidate: () => Promise<void>;
  onCancel: () => void;
  openModal: (flight: Flight, trace?: LatLngTimestamp[]) => void;
  anchorDataPreview: ReturnType<typeof buildAnchorDataPrincipal> | null;
  mapDivRef: React.MutableRefObject<HTMLElement | null>;
}

interface UseAnchorModalOptions {
  handleSelect?: HandleSelectFn;
  debug?: boolean;
}

function formatDateForZip(date: Date): string {
  const pad = (num: number) => num.toString().padStart(2, "0");
  return (
    date.getFullYear() +
    "_" +
    pad(date.getMonth() + 1) +
    "_" +
    pad(date.getDate()) +
    "-" +
    pad(date.getHours()) +
    "_" +
    pad(date.getMinutes()) +
    "_" +
    pad(date.getSeconds())
  );
}

export default function useAnchorModal({
  handleSelect,
  debug = config.debug || config.environment === "development",
}: UseAnchorModalOptions = {}): UseAnchorModal {
  const [anchorModal, setAnchorModal] = useState<AnchorModal | null>(null);
  const [anchorDescription, setAnchorDescription] = useState("");
  const [isZipping, setIsZipping] = useState(false);
  const [anchorDataPreview, setAnchorDataPreview] = useState<ReturnType<typeof buildAnchorDataPrincipal> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const traceRef = useRef<LatLngTimestamp[]>([]);
  const mapDivRef = useRef<HTMLElement | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dlog = useCallback((...args: any) => {
    if (debug) console.log("[useAnchorModal]", ...args);
  }, [debug]);

  const convertTraceRaw = useCallback(
    (trace: LatLngTimestamp[]) =>
      trace.map(([lat, lng, time]) => ({ latitude: lat, longitude: lng, time })),
    []
  );

  const openModal = useCallback((flight: Flight, trace: LatLngTimestamp[] = []) => {
    dlog("Open modal for flight", flight.id);
    traceRef.current = trace;
    setAnchorModal({ flight });
    setAnchorDescription("");
    setMapReady(false);
    setMessage(null);
    if (handleSelect) {
      handleSelect({ ...flight, state: "local" });
    }
    const nowISO = new Date().toISOString();
    const previewData = buildAnchorDataPrincipal(flight, "", "3");
    previewData.extra.anchored_at = null;
    previewData.extra.anchored_requested_at = nowISO;
    setAnchorDataPreview(previewData);
  }, [dlog, handleSelect]);

  const setMapContainer = useCallback((node: HTMLElement | null) => {
    mapDivRef.current = node;
  }, []);

  useEffect(() => {
    if (!anchorModal?.flight) return;
    const newData = buildAnchorDataPrincipal(anchorModal.flight, anchorDescription);
    newData.comment = anchorDescription;
    setAnchorDataPreview(newData);
  }, [anchorDescription, anchorModal]);

  const onCancel = useCallback(() => {
    dlog("Cancel anchor modal");
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setAnchorModal(null);
    setAnchorDescription("");
    traceRef.current = [];
    setAnchorDataPreview(null);
    setMapReady(false);
    setMessage(null);
  }, [dlog]);

  const captureMap = useCallback(async (): Promise<Blob> => {
    if (!mapReady) throw new Error("Map is not ready for capture");
    const node = mapDivRef.current;
    if (!node) throw new Error("Map container not found");
    dlog("Ready for capture:", node);
    await new Promise(res => setTimeout(res, 300));
    const canvas = await html2canvas(node, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: "white",
      scale: 2,
    } as any);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => {
        if (blob) {
          dlog("Capture succeeded");
          resolve(blob);
        } else {
          dlog("Capture failed");
          reject(new Error("Failed to capture map image"));
        }
      }, "image/png", 1.0)
    );
  }, [mapReady, mapDivRef, dlog]);

  const onValidate = useCallback(async () => {
    if (!anchorModal) return;
    setIsZipping(true);
    setMessage(null);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    try {
      await new Promise(res => setTimeout(res, 650));
      dlog("Starting capture");
      const imgBlob = await captureMap();
      dlog("Building anchor data");

      const traceConverted = convertTraceRaw(traceRef.current);
      const anchorData = buildAnchorDataPrincipal(anchorModal.flight, anchorDescription);

      if (!anchorData.extra.anchored_at) anchorData.extra.anchored_at = null;
      if (!anchorData.extra.anchored_requested_at) anchorData.extra.anchored_requested_at = new Date().toISOString();

      const rawData = buildRawData(anchorModal.flight, traceConverted, anchorDescription);

      const zipBlob = await generateZipFromDataWithProof(imgBlob, rawData);

      const flightId = anchorData.extra?.id || "unknown";
      const zipNameVal = `preuves-${flightId}-${formatDateForZip(new Date())}`;
      anchorData.zipName = zipNameVal;
      rawData.zipName = zipNameVal;

      dlog("Sending anchor data and proof to backend...");

      const formData = new FormData();
      formData.append("anchorData", JSON.stringify(anchorData));
      formData.append("proofZip", zipBlob, `${zipNameVal}.zip`);

      const response = await fetch(config.apiUrl + "/anchor", {
        method: "POST",
        body: formData,
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(`Réponse invalide du serveur, status ${response.status}`);
      }

      if (response.ok && result.ok) {
        setMessage("Vol ancré avec succès dans la blockchain");
      } else if (response.status === 403) {
        setMessage("Accès refusé par la blockchain : ressource interdite (403).\nL'ancrage est mis en attente et sera envoyé automatiquement une fois le problème résolu.");
      } else if (response.status === 202 || (result.ok === false && response.status === 200)) {
        setMessage("Vol enregistré localement, envoi blockchain différé");
      } else {
        throw new Error(result.error || `Erreur serveur ${response.status}`);
      }

      if (handleSelect) {
        handleSelect({ ...anchorModal.flight, state: "local" });
      }

      closeTimeoutRef.current = setTimeout(() => {
        onCancel();
      }, 3000);

    } catch (e) {
      setMessage("Erreur lors de l'ancrage : " + (e instanceof Error ? e.message : "Inconnue"));

      closeTimeoutRef.current = setTimeout(() => {
        onCancel();
      }, 5000);
    } finally {
      setIsZipping(false);
    }
  }, [anchorModal, anchorDescription, captureMap, handleSelect, onCancel, dlog, convertTraceRaw]);

  return {
    anchorModal,
    anchorDescription,
    isZipping,
    mapReady,
    message,
    setMessage,
    setAnchorDescription,
    setAnchorModal,
    onValidate,
    onCancel,
    openModal,
    anchorDataPreview,
    mapDivRef,
    setMapContainer,
    setMapReady,
  };
}
