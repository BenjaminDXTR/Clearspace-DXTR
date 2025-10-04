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

  const { drones: rawLiveDrones, historyFiles, fetchHistory, error: dronesError, refreshFilename } = useDrones();

  const { errors, criticalErrors, errorHistory, addError, dismissError } = useErrorManager();

  const onUserError = useCallback(
    (msg: string) => {
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

  dlog("useLocalHistory state:", { currentHistoryFile, localHistoryLength: localHistory.length, localPage, localMaxPage });

  const lastRefreshRef = useRef<string | null>(null);

  // Effet pour refresh à réception notification backend mise à jour
  useEffect(() => {
    if (
      refreshFilename &&
      refreshFilename === currentHistoryFile &&
      lastRefreshRef.current !== refreshFilename
    ) {
      dlog(`[useAppLogic] Refresh notification for current history file ${refreshFilename}, setting currentHistoryFile`);
      lastRefreshRef.current = refreshFilename;
      setCurrentHistoryFile(refreshFilename);
    }
  }, [refreshFilename, currentHistoryFile, setCurrentHistoryFile, dlog]);

  // Gestion erreur historique local
  useEffect(() => {
    if (localHistoryError && !errors.some((e) => e.id === "local-history-error")) {
      addError({
        id: "local-history-error",
        title: "Erreur chargement historique local",
        message: localHistoryError,
        severity: "error",
        dismissible: false,
      });
      dlog(`[useAppLogic] Local history error: ${localHistoryError}`);
    }
    if (!localHistoryError) {
      dismissError("local-history-error");
      dlog(`[useAppLogic] Local history error cleared`);
    }
  }, [localHistoryError, addError, dismissError, errors, dlog]);

  // Fusion vols live et locaux (localHistory utilisé)
  const { liveFlights, localFlights } = useProcessedFlights(
    rawLiveDrones,
    localHistory,
    { debug, onUserError },
    fetchHistory,
    historyFiles
  );

  useEffect(() => {
    console.log("[useAppLogic] Drones live actuellement:", liveFlights);
    console.log("[useAppLogic] Vols locaux actuellement:", localFlights);
  }, [liveFlights, localFlights]);

  const { liveTraces } = useLiveTraces(liveFlights, { debug, onUserError });

  const dronesErrorRef = useRef(false);

  useEffect(() => {
    dlog("[useAppLogic] dronesError change detected:", dronesError, " ref:", dronesErrorRef.current);
    if (dronesError && !dronesErrorRef.current) {
      addError({
        id: "drones-error",
        title: "Problème de connexion au backend",
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
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback(
    (flight) => {
      if (!flight?.id) return;
      setSelected({ ...flight });
      setFlyToTrigger((prev) => prev + 1);
      dlog(`[useAppLogic] Vol sélectionné id=${flight.id}`);
    },
    [dlog]
  );

  const getTraceForFlight = useCallback(
    (flight: Flight): LatLngTimestamp[] => {
      let trace: LatLngTimestamp[] = [];
      if (flight.type === "live") {
        trace = (liveTraces[flight.id]?.trace as LatLngTimestamp[]) ?? [];
        dlog(`[useAppLogic] getTraceForFlight live id=${flight.id} avec trace points=${trace.length}`);
      } else if (flight.type === "local") {
        const ft = (flight as any).trace ?? [];
        if (ft.length > 0 && ft[0].length === 3) {
          trace = ft as LatLngTimestamp[];
        } else if (ft.length > 0 && ft[0].length === 2) {
          trace = ft.map(([lat, lng]: [number, number]) => [lat, lng, 0]);
        }
        dlog(`[useAppLogic] getTraceForFlight local id=${flight.id} avec trace points=${trace.length}`);
      } else {
        dlog(`[useAppLogic] getTraceForFlight vol id=${flight.id} inconnu type: ${flight.type}`);
      }
      return trace;
    },
    [liveTraces, dlog]
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
    if (selected.type === "live") return liveTraces[selected.id]?.trace ?? [];
    if (selected.type === "local") return (selected as any).trace ?? [];
    return [];
  }, [selected, liveTraces]);

  const selectedTraceRaw = selected?.trace;

  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected.type === "event" ? [] : LIVE_DETAILS;
  }, [selected]);

  const isAnchoredFn = useCallback(
    (id: string, created_time: string): boolean =>
      localFlights.some((f) => f.id === id && f.created_time === created_time && !!f.isAnchored),
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

