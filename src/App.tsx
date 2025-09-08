import { useState, useCallback, useMemo } from "react";

import './App.css';

import Header from "./components/layout/Header";
import MapLayout from "./components/layout/MapLayout";
import TablesLayout from "./components/layout/TablesLayout";
import AnchorModalLayout from "./components/layout/AnchorModalLayout";

import useDrones from "./hooks/useDrones";
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

/** Utilitaire pour exporter un objet en JSON */
function exportAsJson(obj: any, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App({ debug = process.env.NODE_ENV === "development" }) {
  const dlog = (...args: any[]) => debug && console.log(...args);

  /** --- Données Live / Local / API --- */
  const { drones, error: dronesError } = useDrones({ debug });
  const { anchored } = useAnchored({ debug });
  const {
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData
  } = useLocalHistory({ debug });
  const {
    traces,
    apiPage,
    setApiPage,
    apiMaxPage,
    apiPageData
  } = useRemoteEvents({ debug });

  /** --- Sélection et déclencheur de recentrage --- */
  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback((flight) => {
    if (!flight?.id) return;
    dlog("[App] Vol sélectionné :", flight);
    setSelected({ ...flight, _type: flight._type ?? "live" });

    // Incrémenter pour forcer le recentrage même si c'est le même vol
    setFlyToTrigger(prev => prev + 1);
  }, [dlog]);

  /** --- Modal Ancrage --- */
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

  /** --- Traces Live et archivage auto --- */
  const { liveTraces } = useLiveTraces(drones, {
    debug,
    onArchiveFlight: (droneId, trace) => {
      const flight = drones.find((d) => d.id === droneId);
      if (flight) {
        dlog("[App] Archivage auto du vol :", droneId);
        setLocalHistory((prev) => [...prev, { ...flight, trace }]);
      }
    }
  });

  /** --- Champs à afficher dans panneau détails --- */
  const detailFields = useMemo(() => {
    if (!selected) return [];
    return selected._type === "event" ? EVENT_DETAILS : LIVE_DETAILS;
  }, [selected]);

  /** --- Trace sélectionnée pour la carte --- */
  const [selectedTracePoints, selectedTraceRaw] = useMemo(() => {
    if (!selected) return [undefined, undefined];

    let trace: LatLng[] = [];

    if (selected._type === "live" || selected._type === "local") {
      trace = liveTraces[selected.id] ?? (selected as any).trace ?? [];
    } else if (selected._type === "event") {
      const t = traces.find((tr) => tr.id === selected.id);
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

    dlog("TRACE sélectionnée pour carte:", trace);

    return [trace, selected._type === "event" ? trace : undefined];
  }, [selected, traces, liveTraces, dlog]);

  /** --- Récupération trace selon type de vol --- */
  const getTraceForFlight = useCallback(
    (flight: Flight): LatLng[] => {
      if (flight._type === "live") {
        return liveTraces[flight.id] ?? [];
      }
      if (flight._type === "local") {
        return (flight as any).trace ?? [];
      }
      if (flight._type === "event") {
        const t = traces.find((tr) => tr.id === flight.id);
        if (t?.points) {
          try {
            return JSON.parse(t.points);
          } catch {
            return [];
          }
        }
      }
      return [];
    },
    [liveTraces, traces]
  );

  /** --- Bouton Ancrage pour tableau --- */
  const renderAnchorCell = useCallback(
    (flight: Flight) => {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rawTrace = getTraceForFlight(flight);
            openModal(flight, rawTrace);
          }}
        >
          Ancrer
        </button>
      );
    },
    [openModal, getTraceForFlight]
  );

  /** --- Export JSON depuis panneau --- */
  const exportSelectedAsAnchorJson = useCallback(() => {
    if (!selected) return;
    const rawTrace = getTraceForFlight(selected);
    const trace = rawTrace.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
      altitude: selected.altitude ?? 0,
    }));
    const anchorData = buildAnchorData(selected, "Export depuis panneau", trace);
    exportAsJson(
      anchorData,
      `drone_${selected.id}_${selected.created_time ?? "unknown"}.json`
    );
  }, [selected, getTraceForFlight]);

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
          flyToTrigger={flyToTrigger} // Transmission du trigger pour recentrage
        />

        <TablesLayout
          error={dronesError}
          drones={drones}
          LIVE_FIELDS={LIVE_FIELDS}
          localPage={localPage}
          localMaxPage={localMaxPage}
          setLocalPage={setLocalPage}
          localPageData={localPageData}
          isAnchored={(id, created_time) =>
            anchored.some((a) => a.id === id && a.created_time === created_time)
          }
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
          {/* Élément pour capture écran */}
          <div className="modal-map-capture" />
        </AnchorModalLayout>
      )}
    </div>
  );
}
