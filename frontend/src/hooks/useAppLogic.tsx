import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useDrones } from "../contexts/DronesContext";
import { useProcessedFlights } from "./useProcessedFlights";
import useLocalHistory from "./useLocalHistory";
import useLiveTraces from "./useLiveTraces";
import useAnchorModal from "./useAnchorModal";
import { useErrorManager } from "./useErrorManager";
import { config } from "../config";
import type { Flight, HandleSelectFn, LatLng, LatLngTimestamp } from "../types/models";
import { buildAnchorDataPrincipal, buildRawData, generateZipFromDataWithProof } from "../services/anchorService";
import { LIVE_DETAILS } from "../utils/constants";
import useDebugLogger from "./useDebugLogger";

export default function useAppLogic() {
  const debug = config.debug || config.environment === "development";

  const dlog = useDebugLogger(debug, "useAppLogic");

  const { drones: rawDrones, historyFiles, fetchHistory, error: dronesError, refreshFilename } = useDrones();

  const { errors, criticalErrors, errorHistory, addError, dismissError } = useErrorManager();

  const onUserError = useCallback(
    (msg: string): void => {
      const id = `user-error-${msg}`;
      if (!errors.some((e) => e.id === id)) {
        addError({
          id,
          title: "Erreur",
          message: msg,
          severity: "error",
          dismissible: true,
        });
        dlog(`[useAppLogic] User error added: ${msg}`);
      }
    },
    [addError, errors, dlog]
  );

  const {
    currentHistoryFile,
    setCurrentHistoryFile,
    localHistory,
    error: localHistoryError,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
  } = useLocalHistory({ fetchHistory, historyFiles, refreshTrigger: refreshFilename, debug, onUserError });

  dlog("useLocalHistory state:", {
    currentHistoryFile,
    localLength: localHistory.length,
    localPage,
    localMaxPage,
  });

  const lastRefreshRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      refreshFilename &&
      refreshFilename === currentHistoryFile &&
      lastRefreshRef.current !== refreshFilename
    ) {
      dlog(`[useAppLogic] Refresh notification received for ${refreshFilename}`);
      lastRefreshRef.current = refreshFilename;
      setCurrentHistoryFile(refreshFilename);
    }
  }, [refreshFilename, currentHistoryFile, setCurrentHistoryFile, dlog]);

  useEffect(() => {
    if (localHistoryError && !errors.some((e) => e.id === "local-history-error")) {
      addError({
        id: "local-history-error",
        title: "Erreur chargement local",
        message: localHistoryError,
        severity: "error",
        dismissible: false,
      });
      dlog(`[useAppLogic] Local history error: ${localHistoryError}`);
    }
    if (!localHistoryError) {
      dismissError("local-history-error");
      dlog("[useAppLogic] Cleared local history error");
    }
  }, [localHistoryError, errors, dismissError, addError, dlog]);

  const { liveFlights, localFlights } = useProcessedFlights(
    rawDrones,
    localHistory,
    { debug, onUserError },
    fetchHistory,
    historyFiles
  );

  useEffect(() => {
    dlog(`[useAppLogic] Live flights count: ${liveFlights.length}`);
    dlog(`[useAppLogic] Local flights count: ${localFlights.length}`);
  }, [liveFlights, localFlights, dlog]);

  const { liveTraces } = useLiveTraces(liveFlights, { debug, onUserError });

  const dronesErrorRef = useRef(false);

  useEffect(() => {
    if (dronesError && !dronesErrorRef.current) {
      addError({
        id: "drones-error",
        title: "Erreur connexion backend",
        message: dronesError,
        severity: "error",
        dismissible: false,
      });
      dronesErrorRef.current = true;
    } else if (!dronesError && dronesErrorRef.current) {
      dismissError("drones-error");
      dronesErrorRef.current = false;
    }
  }, [dronesError, addError, dismissError, dlog]);

  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback(
    (flight: Flight) => {
      if (!flight?.id) {
        dlog("[useAppLogic] handleSelect called with invalid flight");
        return;
      }
      dlog(`[useAppLogic] handleSelect called with flight id=${flight.id}`);
      setSelected({ ...flight });
      setFlyTrigger((prev) => {
        const next = prev + 1;
        dlog(`[useAppLogic] flyTrigger incremented: ${prev} -> ${next}`);
        return next;
      });
    },
    [dlog]
  );

  useEffect(() => {
    dlog(`[useAppLogic] Selected flight trace changed, current flyTrigger=${flyTrigger}`);
  }, [selected?.trace, flyTrigger, dlog]);

  const getTraceForFlight = useCallback(
    (flight: Flight): LatLngTimestamp[] => {
      let trace: LatLngTimestamp[] = [];

      if (flight.type === "live") {
        trace = (liveTraces[flight.id] as { trace: LatLngTimestamp[] } | undefined)?.trace ?? [];
      } else if (flight.type === "local") {
        const raw = (flight as any).trace ?? [];
        if (raw.length > 0) {
          if (raw[0].length === 3) {
            trace = raw as LatLngTimestamp[];
          } else if (raw[0].length === 2) {
            trace = raw.map((pt: any[]) => [pt[0], pt[1], 0]);
          }
        }
      }
      dlog(`[getTraceFlight] Flight id: ${flight.id} trace length: ${trace.length}`);
      return trace;
    },
    [liveTraces, dlog]
  );

  const {
    anchorModal,
    anchorDescription,
    isZipping,
    mapReady,
    setMapReady,
    setMapContainer,
    setAnchorDescription,
    openModal,
    onValidate,
    onCancel,
    anchorDataPreview,
  } = useAnchorModal({ handleSelect, debug });

  const exportJson = useCallback(() => {
    if (!selected) return;
    const trace = getTraceForFlight(selected).map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
      altitude: selected.altitude ?? 0,
    }));
    const data = buildAnchorDataPrincipal(selected, "Export depuis panneau");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `drone_${selected.id}_${selected.created_time ?? "unknown"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    dlog(`[useAppLogic] Export JSON for id=${selected.id}`);
  }, [selected, getTraceForFlight, dlog]);

  const selectedTracePoints = useMemo(() => {
    if (!selected) return [];
    if (selected.type === "live") return liveTraces[selected.id]?.trace ?? [];
    if (selected.type === "local") return (selected as any).trace ?? [];
    return [];
  }, [selected, liveTraces]);

  const selectedTraceRaw = selected?.trace;

  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected.type === "event" ? [] : LIVE_DETAILS;
  }, [selected]);

  const isAnchored = useCallback(
    (id: string, created_time: string) => {
      return localFlights.some((f) => f.id === id && f.created_time === created_time && !!f.isAnchored);
    },
    [localFlights]
  );

  return {
    debug,
    dlog,
    errors,
    criticalErrors,
    errorHistory,
    dismissError,
    addError,
    currentHistoryFile,
    setCurrentHistoryFile,
    historyFiles,
    localHistory,
    error: localHistoryError,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    liveFlights,
    localFlights,
    liveTraces,
    selected,
    setSelected,
    flyTrigger,
    handleSelect,
    getTraceForFlight,
    anchorModal,
    anchorDescription,
    isZipping,
    mapReady,
    setMapReady,
    setMapContainer,
    setAnchorDescription,
    openModal,
    onValidate,
    onCancel,
    anchorDataPreview,
    exportSelectedAsJson: exportJson,
    selectedTracePoints,
    selectedTraceRaw,
    detailFields,
    isAnchored,
    dronesError,
  };
}
