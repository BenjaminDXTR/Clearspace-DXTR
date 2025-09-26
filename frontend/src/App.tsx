import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import './App.css';

import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLayout from "./components/layout/TablesLayout";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";

import useAnchored from "./hooks/useAnchored";
import useLocalHistory from "./hooks/useLocalHistory";
import useRemoteEvents from "./hooks/useRemoteEvents";
import useAnchorModal from "./hooks/useAnchorModal";
import useLiveTraces from "./hooks/useLiveTraces";

import {
  LIVE_FIELDS,
  HISTORY_API_FIELDS,
  LIVE_DETAILS,
  EVENT_DETAILS
} from "./utils/constants";

import { getFlightTrace } from "./utils/coords";
import { buildAnchorData } from "./services/anchorService";
import type { Flight, HandleSelectFn, LatLng } from "./types/models";

import { config } from './config';
import { DronesProvider, useDrones } from './contexts/DronesContext';

// Export utilitaire JSON
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

  // Récupère drones du contexte partagé via WebSocket
  const { drones: wsDrones } = useDrones();

  useEffect(() => {
    dlog(`[AppContent] wsDrones updated, count: ${wsDrones.length}`);
    if (wsDrones.length > 0) {
      console.log("[AppContent] Exemple drone reçu:", wsDrones[0]);
    }
  }, [wsDrones, dlog]);

  const { anchored } = useAnchored({ debug });
  const {
    localHistory, setLocalHistory,
    localPage, setLocalPage,
    localMaxPage, localPageData,
  } = useLocalHistory({ debug });

  const {
    traces,
    apiPage, setApiPage,
    apiMaxPage, apiPageData,
  } = useRemoteEvents({ debug });

  const localIds = useMemo(() => new Set(localHistory.map(f => f.id)), [localHistory]);

  const dronesWithType = useMemo(() => {
    const filtered = wsDrones
      .filter(d => d.latitude !== 0 && d.longitude !== 0)
      //.filter(d => !localIds.has(d.id)) // temporairement commenté pour debug
      .map(d => ({ ...d, _type: "live" as const }));
    console.log(`[AppContent] dronesWithType calculés: ${filtered.length}`);
    return filtered;
  }, [wsDrones, localIds]);

  const liveTracesRef = useRef<Record<string, { flight: Flight; trace: LatLng[] }>>({});

  // Suppression complète de la fonction onArchiveFlight qui faisait des POST vers /history

  const { liveTraces } = useLiveTraces(dronesWithType, { debug });
  liveTracesRef.current = liveTraces;

  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback((flight) => {
    if (!flight?.id) return;
    setSelected({ ...flight, _type: flight._type ?? "live" });
    setFlyToTrigger(prev => prev + 1);
    dlog(`[AppContent] Vol sélectionné id=${flight.id}`);
  }, [dlog]);

  const { anchorModal, anchorDescription, isZipping, setAnchorDescription,
    onValidate: handleAnchorValidate, onCancel: handleAnchorCancel, openModal, anchorDataPreview } = useAnchorModal({ handleSelect, debug });

  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected._type === "event" ? EVENT_DETAILS : LIVE_DETAILS;
  }, [selected]);

  const [selectedTracePoints, selectedTraceRaw] = useMemo(() => {
    if (!selected) return [undefined, undefined];
    let trace: LatLng[] = [];

    if (selected._type === "live") {
      trace = liveTraces[selected.id]?.trace ?? [];
    } else if (selected._type === "local") {
      trace = (selected as any).trace ?? [];
    } else if (selected._type === "event") {
      const t = traces.find(tr => tr.id === selected.id);
      if (t?.points) {
        try {
          trace = JSON.parse(t.points);
        } catch {
          trace = [];
        }
      }
    } else {
      trace = getFlightTrace(selected);
    }
    dlog(`[AppContent] Trace calculée pour vol id=${selected.id}, points=${trace.length}`);
    return [trace, selected._type === "event" ? trace : undefined];
  }, [selected, traces, liveTraces, dlog]);

  const getTraceForFlight = useCallback((flight: Flight): LatLng[] => {
    if (flight._type === "live") return liveTraces[flight.id]?.trace ?? [];
    if (flight._type === "local") return (flight as any).trace ?? [];
    if (flight._type === "event") {
      const t = traces.find(tr => tr.id === flight.id);
      if (t?.points) {
        try {
          return JSON.parse(t.points);
        } catch {
          return [];
        }
      }
    }
    return [];
  }, [liveTraces, traces]);

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
          apiPage={apiPage}
          apiMaxPage={apiMaxPage}
          setApiPage={setApiPage}
          apiPageData={apiPageData}
          HISTORY_API_FIELDS={HISTORY_API_FIELDS}
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
