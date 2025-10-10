import React, { useState, useCallback, useRef, useEffect } from "react";
import type { AnchorModal, Flight, HandleSelectFn, LatLng } from "../types/models";
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
  setAnchorDescription: (desc: string) => void;
  setAnchorModal: (modal: AnchorModal | null) => void;
  setMapContainer: (container: HTMLElement | null) => void;
  setMapReady: (ready: boolean) => void;
  onValidate: () => Promise<void>;
  onCancel: () => void;
  openModal: (flight: Flight, trace?: LatLng[]) => void;
  anchorDataPreview: ReturnType<typeof buildAnchorDataPrincipal> | null;
  mapDivRef: React.MutableRefObject<HTMLElement | null>;
}

interface UseAnchorModalOptions {
  handleSelect?: HandleSelectFn;
  debug?: boolean;
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
  const traceRef = useRef<LatLng[]>([]);
  const mapDivRef = useRef<HTMLElement | null>(null);

  const dlog = useCallback((...args: any) => {
    if (debug) console.log("[useAnchorModal]", ...args);
  }, [debug]);

  const convertTrace = useCallback(
    (trace: LatLng[], altitude: number) =>
      trace.map(([lat, lng]) => ({ latitude: lat, longitude: lng, altitude })),
    []
  );

  const openModal = useCallback((flight: Flight, trace: LatLng[] = []) => {
    dlog("Open modal for flight", flight.id);
    traceRef.current = trace;
    setAnchorModal({ flight });
    setAnchorDescription("");
    setMapReady(false);
    if (handleSelect) {
      handleSelect({ ...flight, state: "local" });
    }
    const traceConverted = convertTrace(trace, flight.altitude ?? 0);
    setAnchorDataPreview(buildAnchorDataPrincipal(flight, ""));
  }, [convertTrace, dlog, handleSelect]);

  const setMapContainer = useCallback((node: HTMLElement | null) => {
    mapDivRef.current = node;
  }, []);

  useEffect(() => {
    if (!anchorModal?.flight) return;
    const traceConverted = convertTrace(traceRef.current, anchorModal.flight.altitude ?? 0);
    const newData = buildAnchorDataPrincipal(anchorModal.flight, anchorDescription);
    dlog("Updated anchor data with description", anchorDescription);
    setAnchorDataPreview(newData);
  }, [anchorDescription, anchorModal, convertTrace, dlog]);

  const onCancel = useCallback(() => {
    dlog("Cancel anchor modal");
    setAnchorModal(null);
    setAnchorDescription("");
    traceRef.current = [];
    setAnchorDataPreview(null);
    setMapReady(false);
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
      logging: false,
    } as any);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          dlog("Capture succeeded");
          resolve(blob);
        } else {
          dlog("Capture failed");
          reject(new Error("Failed to capture map image"));
        }
      }, "image/png", 1.0);
    });
  }, [mapReady, mapDivRef, dlog]);

  const onValidate = useCallback(async () => {
    if (!anchorModal) return;
    setIsZipping(true);
    try {
      await new Promise(res => setTimeout(res, 650));
      dlog("Starting capture");
      const imgBlob = await captureMap();
      dlog("Building anchor data");
      const traceConverted = convertTrace(traceRef.current, anchorModal.flight.altitude ?? 0);
      const anchorData = buildAnchorDataPrincipal(anchorModal.flight, anchorDescription);
      const rawData = buildRawData(anchorModal.flight, traceConverted, anchorDescription);
      dlog("Generating ZIP with proof JSON");
      const zipBlob = await generateZipFromDataWithProof(imgBlob, rawData);
      const zipFileName = `anchor_${anchorData.extra?.id ?? "unknown"}_${new Date().toISOString()}.zip`;

      dlog("Sending anchor data and proof to backend...");
      const formData = new FormData();
      formData.append("anchorData", JSON.stringify(anchorData));
      formData.append("proofZip", zipBlob, zipFileName);

      const response = await fetch(config.apiUrl + "/anchor", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erreur serveur ${response.status} : ${errorText || response.statusText}`);
      }

      const result = await response.json();
      dlog("Anchor saved successfully on backend, folder:", result.folder);

      if (handleSelect) {
        handleSelect({ ...anchorModal.flight, state: "local" });
      }
      onCancel();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      alert("Erreur lors de l'ancrage : " + message);
      dlog("Error during anchoring:", e);
    } finally {
      setIsZipping(false);
    }
  }, [anchorModal, anchorDescription, captureMap, convertTrace, handleSelect, onCancel, dlog]);

  return {
    anchorModal,
    anchorDescription,
    isZipping,
    mapReady,
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
