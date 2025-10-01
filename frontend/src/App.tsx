import { useState, useCallback, useMemo, useEffect } from "react";
import './App.css';

import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLayout from "./components/layout/TablesLayout";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";
import ErrorPanel from "./components/common/ErrorPanel";

import useAnchored from "./hooks/useAnchored";
import useLocalHistory from "./hooks/useLocalHistory";
import useAnchorModal from "./hooks/useAnchorModal";
import useLiveTraces from "./hooks/useLiveTraces";

import { getFlightTrace, stripTimestampFromTrace } from "./utils/coords";

import {
  LIVE_FIELDS,
  LIVE_DETAILS,
} from "./utils/constants";

import { buildAnchorData } from "./services/anchorService";
import type { Flight, HandleSelectFn, LatLng, LatLngTimestamp } from "./types/models";

import { config } from './config';
import { DronesProvider, useDrones } from './contexts/DronesContext';

function exportAsJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function hasValidCoords(obj: any): obj is { latitude: number; longitude: number } {
  return (
    obj &&
    typeof obj.latitude === "number" && obj.latitude !== 0 &&
    typeof obj.longitude === "number" && obj.longitude !== 0
  );
}

function AppContent() {
  const debug = config.debug || config.environment === 'development';
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[App]", ...args);
    }
  }, [debug]);

  const { drones: wsDrones, historyFiles, fetchHistoryFile, error } = useDrones();

  const [historicalFlights, setHistoricalFlights] = useState<Flight[]>([]);
  const [currentHistoryFile, setCurrentHistoryFile] = useState<string | null>(null);

  const {
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
  } = useLocalHistory({ debug });

  useEffect(() => {
    dlog(`[AppContent] wsDrones updated, count: ${wsDrones.length}`);
  }, [wsDrones, dlog]);

  useEffect(() => {
    dlog(`[AppContent] Historique fichiers disponibles: ${historyFiles.length}`);
  }, [historyFiles, dlog]);

  useEffect(() => {
    const flightsWithType = historicalFlights.map(f => ({
      ...f,
      _type: (f.type === "local" ? "local" : "live") as "live" | "local"
    }));
    setLocalHistory(flightsWithType.filter(f => f._type === "local"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalFlights]);

  useEffect(() => {
    if (historyFiles.length === 0) {
      setCurrentHistoryFile(null);
      setHistoricalFlights([]);
      dlog("[AppContent] Aucun fichier historique disponible");
      return;
    }
    const latestFile = historyFiles[historyFiles.length - 1];
    if (currentHistoryFile === null || !historyFiles.includes(currentHistoryFile)) {
      dlog(`[AppContent] Chargement automatique dernier fichier historique : ${latestFile}`);
      setCurrentHistoryFile(latestFile);
      handleLoadHistoricalFile(latestFile);
    } else {
      dlog(`[AppContent] Rafraîchissement du fichier historique courant: ${currentHistoryFile}`);
      handleLoadHistoricalFile(currentHistoryFile);
    }
  }, [historyFiles, currentHistoryFile, dlog]);

  const handleLoadHistoricalFile = useCallback(async (filename: string) => {
    dlog(`[AppContent] Chargement historique fichier: ${filename}`);
    const flights = await fetchHistoryFile(filename);
    dlog(`[AppContent] Vols historiques chargés: ${flights.length}`);
    setHistoricalFlights(flights);
  }, [fetchHistoryFile, dlog]);

  const combinedFlights = useMemo(() => {
    const processedLiveDrones = wsDrones.map(d => ({ ...d, _type: "live" as const }));
    return [...historicalFlights, ...processedLiveDrones];
  }, [historicalFlights, wsDrones]);

  const { anchored } = useAnchored({ debug });

  const dronesWithType = useMemo(() => {
    const filtered = combinedFlights
      .filter(d => d._type === "live" || d._type === "local")
      .filter(d => hasValidCoords(d))
      .map(d => ({ ...d, _type: d._type ?? "live" as const }));

    dlog(`[AppContent] dronesWithType calculés: ${filtered.length}`);
    return filtered;
  }, [combinedFlights, dlog]);

  const { liveTraces } = useLiveTraces(dronesWithType.filter(d => d._type === "live"), { debug });

  useEffect(() => {
    dlog('[AppContent] liveTraces updated', liveTraces);
  }, [liveTraces, dlog]);

  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const [errors, setErrors] = useState<string[]>([]); // gestion des erreurs multiples

  // Synchroniser erreurs du contexte DronesContext dans la liste d’erreurs
  useEffect(() => {
    if (error) {
      setErrors(prev => [...prev, error]);
    }
  }, [error]);

  const handleSelect: HandleSelectFn = useCallback((flight) => {
    if (!flight?.id) return;
    setSelected({ ...flight, _type: flight._type ?? "live" });
    setFlyToTrigger(prev => prev + 1);
    dlog(`[AppContent] Vol sélectionné id=${flight.id}`);
  }, [dlog]);

  const getTraceForFlight = useCallback((flight: Flight): LatLng[] => {
    if (flight._type === "live") {
      const trace = liveTraces[flight.id]?.trace ?? [];
      return stripTimestampFromTrace(trace as LatLngTimestamp[]);
    }
    if (flight._type === "local") {
      const trace = (flight as any).trace ?? [];
      if (trace.length > 0 && trace[0].length === 3) {
        return stripTimestampFromTrace(trace as LatLngTimestamp[]);
      } else {
        return trace as LatLng[];
      }
    }
    return [];
  }, [liveTraces]);

  const renderAnchorCell = useCallback((flight: Flight) => (
    <button onClick={e => {
      e.stopPropagation();
      const rawTrace = getTraceForFlight(flight);
      openModal(flight, rawTrace);
      dlog(`[AppContent] Clic Ancrer vol id=${flight.id}`);
    }}>
      Ancrer
    </button>
  ), [getTraceForFlight, dlog]);

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

  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected._type === "event" ? [] : LIVE_DETAILS;
  }, [selected]);

  const selectedTracePoints = useMemo(() => {
    if (!selected) return [];
    if (selected._type === "live") return liveTraces[selected.id]?.trace ?? [];
    if (selected._type === "local") return (selected as any).trace ?? [];
    return [];
  }, [selected, liveTraces]);

  const selectedTraceRaw = selected?.trace;

  const exportSelectedAsAnchorJson = useCallback(() => {
    if (!selected) return;
    const rawTrace = getTraceForFlight(selected);
    const trace = rawTrace.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
      altitude: selected.altitude ?? 0,
    }));
    const anchorData = buildAnchorData(selected, "Export depuis panneau", trace);
    exportAsJson(anchorData, `drone_${selected.id}_${selected.created_time ?? "unknown"}.json`);
    dlog(`[AppContent] Export JSON vol id=${selected.id}`);
  }, [selected, getTraceForFlight, dlog]);

  return (
    <div>
      <Header />
      {/* Zone dédiée affichage erreurs */}
        {errors.length > 0 && <ErrorPanel errors={errors} />}
      <div className="container-detections">
        
        
        <MapLayout
          selectedTracePoints={selectedTracePoints}
          selectedTraceRaw={selectedTraceRaw}
          selected={selected}
          detailFields={detailFields}
          exportObj={exportSelectedAsAnchorJson}
          flyToTrigger={flyToTrigger}
        />
        <TablesLayout
          error={null}
          drones={dronesWithType}
          LIVE_FIELDS={LIVE_FIELDS}
          localPage={localPage}
          localMaxPage={localMaxPage}
          setLocalPage={setLocalPage}
          localPageData={localPageData}
          isAnchored={(id, created_time) => anchored.some(a => a.id === id && a.created_time === created_time)}
          renderAnchorCell={renderAnchorCell}
          handleSelect={handleSelect}
          debug={debug}
        />
      </div>

      {anchorModal && (
        <AnchorModalLayout
          anchorModal={anchorModal}
          anchorDataPreview={anchorDataPreview}
          anchorDescription={anchorDescription}
          setAnchorDescription={setAnchorDescription}
          getFlightTrace={getFlightTrace}
          isZipping={isZipping}
          onValidate={handleAnchorValidate}
          onCancel={handleAnchorCancel}
        >
          <div className="modal-map-capture" />
        </AnchorModalLayout>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DronesProvider>
      <AppContent />
    </DronesProvider>
  );
}
