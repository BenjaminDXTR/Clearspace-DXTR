import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useDrones } from "../contexts/DronesContext";
import { useProcessedFlights } from "./useProcessedFlights";
import useLocalHistory from "./useLocalHistory";
import useLiveTraces from "./useLiveTraces";
import useAnchorModal from "./useAnchorModal";
import { useErrorManager } from "./useErrorManager";
import { config } from "../config";
import type { Flight, HandleSelectFn, LatLngTimestamp } from "../types/models";
import { buildAnchorDataPrincipal } from "../services/anchorService";
import { LIVE_DETAILS } from "../utils/constants";
import useDebugLogger from "./useDebugLogger";

export default function useAppLogic() {
  const debug = config.debug || config.environment === "development";
  const dlog = useDebugLogger(debug, "useAppLogic");

  // Contrôle accès backend
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [errorHtml, setErrorHtml] = useState<string | null>(null);

  // Drones
  const { drones: rawDrones, historyFiles, fetchHistory, error: dronesError, refreshFilename } = useDrones();

  // Gestion erreurs
  const { errors, criticalErrors, errorHistory, addError, dismissError } = useErrorManager();

  const onUserError = useCallback(
    (msg: string): void => {
      const id = `user-error-${msg}`;
      if (!errors.some((e) => e.id === id)) {
        addError({ id, title: "Erreur", message: msg, severity: "error", dismissible: true });
        dlog(`[useAppLogic] User error added: ${msg}`);
      }
    },
    [addError, errors, dlog]
  );

  // Historique local
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

  dlog("useLocalHistory state:", { currentHistoryFile, localLength: localHistory.length, localPage, localMaxPage });

  const lastRefreshRef = useRef<string | null>(null);
  useEffect(() => {
    if (refreshFilename && refreshFilename === currentHistoryFile && lastRefreshRef.current !== refreshFilename) {
      dlog(`[useAppLogic] Refresh notification received for ${refreshFilename}`);
      lastRefreshRef.current = refreshFilename;
      setCurrentHistoryFile(refreshFilename);
    }
  }, [refreshFilename, currentHistoryFile, setCurrentHistoryFile, dlog]);

  // Gestion erreurs historique local
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

  // Traitement vols
  const { liveFlights, localFlights } = useProcessedFlights(rawDrones, localHistory, { debug, onUserError }, fetchHistory, historyFiles);

  useEffect(() => {
    dlog(`[useAppLogic] Live flights count: ${liveFlights.length}`);
    dlog(`[useAppLogic] Local flights count: ${localFlights.length}`);
  }, [liveFlights, localFlights, dlog]);

  // Traces live
  const { liveTraces } = useLiveTraces(liveFlights, { debug, onUserError });

  const dronesErrorRef = useRef(false);
  useEffect(() => {
    if (dronesError && !dronesErrorRef.current) {
      addError({ id: "drones-error", title: "Erreur connexion backend", message: dronesError, severity: "error", dismissible: false });
      dronesErrorRef.current = true;
    } else if (!dronesError && dronesErrorRef.current) {
      dismissError("drones-error");
      dronesErrorRef.current = false;
    }
  }, [dronesError, addError, dismissError, dlog]);

  // Vol sélectionné
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
      setFlyTrigger((prev) => prev + 1);
    },
    [dlog]
  );

  useEffect(() => {
    dlog(`[useAppLogic] Selected flight trace changed, current flyTrigger=${flyTrigger}`);
  }, [selected?.trace, flyTrigger, dlog]);

  // Récupérer trace vol
  const getTraceForFlight = useCallback(
    (flight: Flight): LatLngTimestamp[] => {
      let trace: LatLngTimestamp[] = [];

      if (flight.state === "live" || flight.state === "waiting") {
        trace = (liveTraces[flight.id] as { trace: LatLngTimestamp[] } | undefined)?.trace ?? [];
      } else if (flight.state === "local") {
        const raw = (flight as any).trace ?? [];
        if (raw.length > 0) {
          if (raw[0].length === 3) {
            trace = raw as LatLngTimestamp[];
          } else if (raw[0].length === 2) {
            trace = raw.map((pt: any[]) => [pt[0], pt[1], 0]);
          }
        }
      }

      dlog(`[getTraceFlight] Flight id: ${flight.id} state: ${flight.state} trace length: ${trace.length}`);
      return trace;
    },
    [liveTraces, dlog]
  );

  // Modal ancrage
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
    message,
    setMessage,
  } = useAnchorModal({ handleSelect, debug });

  // Export JSON
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

  // Points trace sélectionnés
  const selectedTracePoints = useMemo(() => {
    if (!selected) return [];
    if (selected.state === "live" || selected.state === "waiting")
      return liveTraces[selected.id]?.trace ?? [];
    if (selected.state === "local") return (selected as any).trace ?? [];
    return [];
  }, [selected, liveTraces]);

  const selectedTraceRaw = selected?.trace;

  // Champs détails sélectionnés
  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected.state === "event" ? [] : LIVE_DETAILS;
  }, [selected]);

  // Etat ancrage
  const getAnchorState = useCallback(
    (id: string, created_time: string): "none" | "pending" | "anchored" => {
      const flight = localFlights.find((f) => f.id === id && f.created_time === created_time);
      return flight?.anchorState ?? "none";
    },
    [localFlights]
  );

// Contrôle d'accès backend
useEffect(() => {
  setLoadingAccess(true);
  fetch("/api/check-access", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) {
        return res.text().then((text) => {
          setAccessDenied(true);
          setErrorHtml(text);
          throw new Error("Accès refusé");
        });
      }
      return res.json();
    })
    .then(() => {
      setAccessDenied(false);
      setErrorHtml(null);
    })
    .catch(() => {
      setAccessDenied(true);
      setErrorHtml("<h1>Erreur réseau lors de la vérification d'accès</h1>");
    })
    .finally(() => {
      setLoadingAccess(false);
    });
}, []);

// Contrôle d'accès backend
useEffect(() => {
  setLoadingAccess(true);
  fetch("/api/check-access", { cache: "no-store" })
    .then((res) => {
      if (!res.ok) {
        return res.text().then((text) => {
          setErrorHtml(text);
          setAccessDenied(true);
          throw new Error("Accès refusé");
        });
      }
      return res.json();
    })
    .then(() => {
      setAccessDenied(false);
      setErrorHtml(null);
    })
    .catch(() => {
      if (!errorHtml) {
        setErrorHtml("<h1>Erreur réseau lors de la vérification d'accès</h1>");
      }
      setAccessDenied(true);
    })
    .finally(() => {
      setLoadingAccess(false);
    });
}, []);


const selectedKey = useMemo(() => {
  if (!selected) return null;
  return { id: selected.id, created_time: selected.created_time };
}, [selected]);


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
    selectedKey,
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
    message,
    setMessage,
    exportSelectedAsJson: exportJson,
    selectedTracePoints,
    selectedTraceRaw,
    detailFields,
    getAnchorState,
    dronesError,
    accessDenied,
    setAccessDenied,
    loadingAccess,
    errorHtml,
    setErrorHtml,
  };
}
