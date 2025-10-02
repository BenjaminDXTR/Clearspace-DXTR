import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useDrones } from "../contexts/DronesContext";
import { useProcessedFlights } from "./useProcessedFlights";
import useLocalHistory from "./useLocalHistory";
import useLiveTraces from "./useLiveTraces";
import useAnchorModal from "./useAnchorModal";
import { useErrorManager } from "./useErrorManager";
import { config } from "../config";
import type { Flight, HandleSelectFn, LatLng, LatLngTimestamp } from "../types/models";
import { buildAnchorData } from "../services/anchorService";
import { LIVE_DETAILS } from "../utils/constants";

export default function useAppLogic() {
  const debug = config.debug || config.environment === "development";

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useAppLogic]", ...args);
  }, [debug]);

  const { drones: rawLiveDrones, historyFiles, fetchHistory, error: dronesError } = useDrones();

  const {
    currentHistoryFile,
    setCurrentHistoryFile,
    localHistory: rawLocalFlights,
    error: localHistoryError,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
  } = useLocalHistory({ fetchHistory, historyFiles, debug });

  const { errors, criticalErrors, errorHistory, addError, dismissError } = useErrorManager();

  useEffect(() => {
    if (dronesError && !errors.some((e) => e.id === "drones-error")) {
      addError({
        id: "drones-error",
        title: "Problème de connexion au backend",
        message: dronesError,
        severity: "error",
        dismissible: false,
      });
    }
    if (!dronesError) {
      dismissError("drones-error");
    }
  }, [dronesError, addError, dismissError, errors]);

  useEffect(() => {
    if (localHistoryError && !errors.some((e) => e.id === "local-history-error")) {
      addError({
        id: "local-history-error",
        title: "Erreur chargement historique local",
        message: localHistoryError,
        severity: "error",
        dismissible: false,
      });
    }
    if (!localHistoryError) {
      dismissError("local-history-error");
    }
  }, [localHistoryError, addError, dismissError, errors]);

  const { liveFlights, localFlights } = useProcessedFlights(
    rawLiveDrones,
    rawLocalFlights,
    { debug },
    fetchHistory,
    historyFiles
  );

  const { liveTraces } = useLiveTraces(liveFlights, { debug });

  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback(
    (flight) => {
      if (!flight?.id) return;
      setSelected({ ...flight, _type: flight._type ?? "live" });
      setFlyToTrigger((prev) => prev + 1);
      dlog(`[useAppLogic] Vol sélectionné id=${flight.id}`);
    },
    [dlog]
  );

  const getTraceForFlight = useCallback(
    (flight: Flight): LatLngTimestamp[] => {
      if (flight._type === "live") {
        return (liveTraces[flight.id]?.trace as LatLngTimestamp[]) ?? [];
      }
      if (flight._type === "local") {
        const trace = (flight as any).trace ?? [];
        if (trace.length > 0 && trace[0].length === 3) return trace as LatLngTimestamp[];
        if (trace.length > 0 && trace[0].length === 2) return trace.map(([lat, lng]: [number, number]) => [lat, lng, 0]);
        return [];
      }
      return [];
    },
    [liveTraces]
  );

  const {
    anchorModal,
    anchorDescription,
    isZipping,
    setAnchorDescription,
    onValidate: handleAnchorValidate,
    onCancel: handleAnchorCancel,
    openModal,
    anchorDataPreview,
  } = useAnchorModal({ handleSelect, debug });

  const exportSelectedAsAnchorJson = useCallback(() => {
    if (!selected) return;
    const rawTrace = getTraceForFlight(selected);
    const trace = rawTrace.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
      altitude: selected.altitude ?? 0,
    }));
    const anchorData = buildAnchorData(selected, "Export depuis panneau", trace);
    const blob = new Blob([JSON.stringify(anchorData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drone_${selected.id}_${selected.created_time ?? "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dlog(`[useAppLogic] Export JSON vol id=${selected.id}`);
  }, [selected, getTraceForFlight, dlog]);

  const selectedTracePoints = useMemo(() => {
    if (!selected) return [];
    if (selected._type === "live") return liveTraces[selected.id]?.trace ?? [];
    if (selected._type === "local") return (selected as any).trace ?? [];
    return [];
  }, [selected, liveTraces]);

  const selectedTraceRaw = selected?.trace;

  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected._type === "event" ? [] : LIVE_DETAILS;
  }, [selected]);

  const isAnchoredFn = useCallback(
    (id: string, created_time: string): boolean => localFlights.some((f) => f.id === id && f.created_time === created_time && !!f.isAnchored),
    [localFlights]
  );

  const renderAnchorCell = useCallback(
    (flight: Flight) => (
      <button
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation();
          const traceLatLngTimestamp = getTraceForFlight(flight);
          const trace: LatLng[] = traceLatLngTimestamp.map(([lat, lng]) => [lat, lng]);
          openModal(flight, trace);
          dlog(`[useAppLogic] Clic Ancrer vol id=${flight.id}`);
        }}
      >
        Ancrer
      </button>
    ),
    [getTraceForFlight, dlog, openModal]
  );

  return {
    debug,
    dlog,
    errors,
    criticalErrors,
    errorHistory,
    dismissError,
    currentHistoryFile,
    setCurrentHistoryFile,
    localHistory: rawLocalFlights,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    liveFlights,
    localFlights,
    liveTraces,
    selected,
    setSelected,
    flyToTrigger,
    handleSelect,
    getTraceForFlight,
    anchorModal,
    anchorDescription,
    isZipping,
    setAnchorDescription,
    handleAnchorValidate,
    handleAnchorCancel,
    openModal,
    anchorDataPreview,
    exportSelectedAsAnchorJson,
    selectedTracePoints,
    selectedTraceRaw,
    detailFields,
    dronesError,
    localHistoryError,
    isAnchoredFn,
    renderAnchorCell,
  };
}
