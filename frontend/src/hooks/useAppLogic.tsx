// src/hooks/useAppLogic.ts
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import useDebugLogger from "./useDebugLogger";

export default function useAppLogic() {
  const debug = config.debug || config.environment === "development";

  // Utilisation du hook useDebugLogger pour les logs conditionnels
  const dlog = useDebugLogger(debug, "useAppLogic");

  const { drones: rawDrones, historyFiles, fetchHistory, error: dronesError, refreshFilename } = useDrones();

  const { errors, criticalErrors, errorHistory, addError, dismissError } = useErrorManager();

  const onUserError = useCallback(
    (msg: string) => {
      const id = `user-error-${msg}`;
      if (!errors.some(e => e.id === id)) {
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

  dlog("useLocalHistory state:", { currentHistoryFile, localHistoryLength: localHistory.length, localPage, localMaxPage });

  const lastRefreshRef = useRef<string | null>(null);

  useEffect(() => {
    if (refreshFilename && refreshFilename === currentHistoryFile && lastRefreshRef.current !== refreshFilename) {
      dlog(`[useAppLogic] Refresh notification received for file ${refreshFilename}, updating currentHistoryFile`);
      lastRefreshRef.current = refreshFilename;
      setCurrentHistoryFile(refreshFilename);
    }
  }, [refreshFilename, currentHistoryFile, setCurrentHistoryFile, dlog]);

  useEffect(() => {
    if (localHistoryError && !errors.some(e => e.id === "local-history-error")) {
      addError({
        id: "local-history-error",
        title: "Erreur de chargement historique local",
        message: localHistoryError,
        severity: "error",
        dismissible: false,
      });
      dlog(`[useAppLogic] Local history error: ${localHistoryError}`);
    }
    if (!localHistoryError) {
      dismissError("local-history-error");
      dlog(`[useAppLogic] Cleared local history error`);
    }
  }, [localHistoryError, errors, dismissError, addError, dlog]);

  const { liveFlights, localFlights } = useProcessedFlights(
    rawDrones,
    localHistory,
    { debug, onUserError },
    fetchHistory,
    historyFiles,
  );

  useEffect(() => {
    dlog("[useAppLogic] Live flights count:", liveFlights.length);
    dlog("[useAppLogic] Local flights count:", localFlights.length);
  }, [liveFlights, localFlights, dlog]);

  const { liveTraces } = useLiveTraces(liveFlights, { debug, onUserError });

  const dronesErrorRef = useRef(false);

  useEffect(() => {
    dlog("[useAppLogic] dronesError changed:", dronesError, " ref:", dronesErrorRef.current);
    if (dronesError && !dronesErrorRef.current) {
      addError({
        id: "drones-error",
        title: "Connexion backend échouée",
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

  const [selected, setSelected] = useState<Flight|null>(null);
  const [flyTrigger, setFlyTrigger] = useState(0);

  useEffect(() => {
    if (selected) {
      dlog(`[useAppLogic] Detected selected flight trace change`);
      setFlyTrigger(prev => {
        const next = prev + 1;
        dlog(`[useAppLogic] flyTrigger incremented ${prev} -> ${next}`);
        return next;
      });
    }
  }, [selected?.trace]);

  const handleSelect: HandleSelectFn = useCallback((flight) => {
    if (!flight?.id) {
      dlog("[useAppLogic] Invalid flight selection attempt", flight);
      return;
    }
    dlog(`[useAppLogic] Selecting flight id=${flight.id}`);
    setSelected({...flight});
    setFlyTrigger(prev => {
      const next = prev + 1;
      dlog(`[useAppLogic] flyTrigger incremented ${prev} -> ${next}`);
      return next;
    });
  }, [dlog]);

  const getTraceForFlight = useCallback((flight: Flight): LatLngTimestamp[] => {
    let trace: LatLngTimestamp[] = [];
    if (flight.type === "live") {
      trace = (liveTraces[flight.id]?.trace ?? []) as LatLngTimestamp[];
      dlog(`[useAppLogic] getTraceForFlight live id=${flight.id} points=${trace.length}`);
    } else if (flight.type === "local") {
      const rawTrace = (flight as any).trace ?? [];
      if (rawTrace.length > 0 && rawTrace[0].length === 3) {
        trace = rawTrace as LatLngTimestamp[];
      } else if (rawTrace.length > 0 && rawTrace[0].length === 2) {
        trace = rawTrace.map(([lat, lng]: [number, number]) => [lat, lng, 0]);
      }
      dlog(`[useAppLogic] getTraceForFlight local id=${flight.id} points=${trace.length}`);
    }
    return trace;
  }, [liveTraces, dlog]);

  const {
    anchorModal,
    anchorDescription,
    isZipping,
    setAnchorDescription,
    onValidate,
    onCancel,
    openModal,
    anchorDataPreview,
  } = useAnchorModal({handleSelect, debug});

  const exportSelectedAsJson = useCallback(() => {
    if (!selected) return;
    const rawTrace = getTraceForFlight(selected);
    const trace = rawTrace.map(([lat, lng]) => ({latitude: lat, longitude: lng, altitude: selected.altitude ?? 0}));
    const data = buildAnchorData(selected, "Export depuis panneau", trace);
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drone_${selected.id}_${selected.created_time ?? "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    dlog(`[useAppLogic] Exported JSON for flight id=${selected.id}`);
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

  const isAnchored = useCallback((id: string, created_time: string) => {
    return localFlights.some(f => f.id === id && f.created_time === created_time && !!f.isAnchored);
  }, [localFlights]);

  const renderAnchorCell = useCallback((flight: Flight) => (
    <button
      onClick={e => {
        e.stopPropagation();
        const trace = getTraceForFlight(flight);
        const latLngTrace: LatLng[] = trace
          .map(pt => pt.length >= 2 ? [pt[0], pt[1]] as LatLng : null)
          .filter((pt): pt is LatLng => pt !== null);
        openModal(flight, latLngTrace);
        dlog(`[useAppLogic] Anchor button clicked for flight id=${flight.id}`);
      }}
    >
      Ancrer
    </button>
  ), [getTraceForFlight, openModal, dlog]);

  return {
    debug,
    dlog,
    errors,
    criticalErrors,
    errorHistory,
    dismissError,
    currentHistoryFile,
    setCurrentHistoryFile,
    historyFiles,
    localHistory,
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
    setAnchorDescription,
    onValidate,
    onCancel,
    openModal,
    anchorDataPreview,
    exportSelectedAsJson,
    selectedTracePoints,
    selectedTraceRaw,
    detailFields,
    dronesError,
    localHistoryError,
    isAnchored,
    renderAnchorCell,
  };
}

