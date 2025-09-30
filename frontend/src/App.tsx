import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import './App.css';

import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLayout from "./components/layout/TablesLayout";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";

import useAnchored from "./hooks/useAnchored";
import useLocalHistory from "./hooks/useLocalHistory";
import useAnchorModal from "./hooks/useAnchorModal";
import useLiveTraces from "./hooks/useLiveTraces";

import {
  LIVE_FIELDS,
  LIVE_DETAILS,
} from "./utils/constants";

import { getFlightTrace } from "./utils/coords";
import { buildAnchorData } from "./services/anchorService";
import type { Flight, HandleSelectFn, LatLng } from "./types/models";

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

function AppContent() {
  const debug = config.environment === 'development' || config.debug;
  const dlog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[App]", ...args);
    }
  }, [debug]);

  const { drones: wsDrones, historyFiles, fetchHistoryFile } = useDrones();

  const [historicalFlights, setHistoricalFlights] = useState<Flight[]>([]);
  const [currentHistoryFile, setCurrentHistoryFile] = useState<string | null>(null);

  const {
    localHistory,
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
  } = useLocalHistory({ debug });

  useEffect(() => {
    dlog(`[AppContent] wsDrones updated, count: ${wsDrones.length}`);
    dlog('[AppContent] wsDrones data:', wsDrones);
  }, [wsDrones, dlog]);

  useEffect(() => {
    dlog(`[AppContent] Historique fichiers disponibles: ${historyFiles.length}`);
    dlog('[AppContent] historyFiles data:', historyFiles);
  }, [historyFiles, dlog]);

  // Synchroniser localHistory avec les vols historiques chargés en forçant _type à partir de type backend
  useEffect(() => {
    const flightsWithType = historicalFlights.map(f => ({
      ...f,
      _type: (f.type === "local" ? "local" : "live") as "live" | "local"
    }));
    setLocalHistory(flightsWithType.filter(f => f._type === "local"));
  }, [historicalFlights, setLocalHistory]);

  // Charger automatiquement et suivre le dernier fichier historique
  useEffect(() => {
    if (historyFiles.length === 0) {
      setCurrentHistoryFile(null);
      setHistoricalFlights([]);
      dlog("[AppContent] Aucun fichier historique disponible");
      return;
    }
    const latestFile = historyFiles[historyFiles.length - 1];
    if (currentHistoryFile === null) {
      dlog(`[AppContent] Chargement automatique dernier fichier historique : ${latestFile}`);
      setCurrentHistoryFile(latestFile);
      handleLoadHistoricalFile(latestFile);
    } else if (!historyFiles.includes(currentHistoryFile)) {
      dlog(`[AppContent] Fichier historique courant disparu, chargement: ${latestFile}`);
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
    dlog('[AppContent] Détail vols historiques:', flights);
    setHistoricalFlights(flights);
  }, [fetchHistoryFile, dlog]);

  // Combine vols live (websocket) et archivés (local)
  const combinedFlights = useMemo(() => {
    const processedLiveDrones = wsDrones.map(d =>
      d._type === "live" ? d : { ...d, _type: "live" as const }
    );
    return [...historicalFlights, ...processedLiveDrones];
  }, [historicalFlights, wsDrones]);

  const { anchored } = useAnchored({ debug });

  const localIds = useMemo(() => new Set(localHistory.map(f => f.id)), [localHistory]);

  const dronesWithType = useMemo(() => {
    const filtered = combinedFlights
      .filter(d => d._type === "live" || d._type === "local")
      .filter(d => d.latitude !== 0 && d.longitude !== 0)
      .map(d => ({ ...d, _type: d._type ?? "live" as const }));
      
    dlog(`[AppContent] dronesWithType calculés: ${filtered.length}`);
    dlog('[AppContent] dronesWithType data:', filtered);
    return filtered;
  }, [combinedFlights, dlog]);

  const liveTracesRef = useRef<Record<string, { flight: Flight; trace: LatLng[] }>>({});

  const { liveTraces } = useLiveTraces(dronesWithType.filter(d => d._type === "live"), { debug });

  useEffect(() => {
    Object.entries(liveTraces).forEach(([id, data]) => {
      dlog(`[AppContent] liveTrace drone ${id}, trace points: ${data.trace?.length ?? 0}`);
    });
    dlog('[AppContent] liveTraces full data:', liveTraces);
  }, [liveTraces, dlog]);

  liveTracesRef.current = liveTraces;

  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback((flight) => {
    if (!flight?.id) return;
    setSelected({ ...flight, _type: flight._type ?? "live" });
    setFlyToTrigger(prev => prev + 1);
    dlog(`[AppContent] Vol sélectionné id=${flight.id}`);
  }, [dlog]);

  const {
    anchorModal,
    anchorDescription,
    isZipping,
    setAnchorDescription,
    onValidate: handleAnchorValidate,
    onCancel: handleAnchorCancel,
    openModal,
    anchorDataPreview
  } = useAnchorModal({ handleSelect, debug });

  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected._type === "event" ? [] : LIVE_DETAILS;
  }, [selected]);

  const [selectedTracePoints, selectedTraceRaw] = useMemo(() => {
    if (!selected) return [undefined, undefined];
    let trace: LatLng[] = [];

    if (selected._type === "live") {
      trace = liveTraces[selected.id]?.trace ?? [];
      dlog(`[AppContent] (selected live) Trace points count: ${trace.length}`);
    } else if (selected._type === "local") {
      trace = (selected as any).trace ?? [];
      dlog(`[AppContent] (selected local) Trace points count: ${trace.length}`);
    } else {
      trace = getFlightTrace(selected);
      dlog(`[AppContent] (selected fallback) Trace points count: ${trace.length}`);
    }

    return [trace, undefined];
  }, [selected, liveTraces, dlog]);

  const getTraceForFlight = useCallback((flight: Flight): LatLng[] => {
    if (flight._type === "live") return liveTraces[flight.id]?.trace ?? [];
    if (flight._type === "local") return (flight as any).trace ?? [];
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
  ), [openModal, getTraceForFlight, dlog]);

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

      <div className="history-file-container">
        <h3>Historique des vols</h3>
        {historyFiles.length === 0 ? (
          <p>Aucun historique disponible</p>
        ) : (
          <ul>
            {historyFiles.map(filename => (
              <li key={filename}>
                <button onClick={() => handleLoadHistoricalFile(filename)}>{filename}</button>
              </li>
            ))}
          </ul>
        )}
        <p>{historicalFlights.length} vols historiques chargés</p>
      </div>
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
