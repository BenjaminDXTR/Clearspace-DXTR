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

import { config } from './config';

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

export default function App() {
  const debug = config.debug || config.environment === 'development';
  const dlog = (...args: any[]) => debug && console.log("[App]", ...args);

  /** --- Données Live / Local / API --- */
  const { drones, error: dronesError } = useDrones({ debug });
  const { anchored } = useAnchored({ debug });
  const {
    localHistory,
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

  // Locks IDs des vols archivés locaux pour exclusion de la liste live
  const localIds = useMemo(() => new Set(localHistory.map(f => f.id)), [localHistory]);

  // Forcer _type: "live" et filtrer drones avec coordonnées valides et non archivés
  const dronesWithType = drones
    .filter(d => d.latitude !== 0 && d.longitude !== 0)
    .filter(d => !localIds.has(d.id)) // Exclure vols archivés
    .map((d): Flight => ({
      ...d,
      _type: "live" as "live",
    }));

  /** --- Sélection et déclencheur de recentrage --- */
  const [selected, setSelected] = useState<Flight | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const handleSelect: HandleSelectFn = useCallback((flight) => {
    if (!flight?.id) return;
    setSelected({ ...flight, _type: flight._type ?? "live" });
    setFlyToTrigger(prev => prev + 1);
  }, []);

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
const { liveTraces } = useLiveTraces(dronesWithType, {
  debug,
  onArchiveFlight: async (droneId, trace) => {
    const flight = drones.find(d => d.id === droneId);
    if (!flight) return;

    // Définition explicite de archivedFlight avant usage
    const archivedFlight: Flight = {
      ...flight,
      trace,
      _type: "local"
    };

    try {
      const response = await fetch('/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(archivedFlight)
      });
      if (!response.ok) throw new Error('Erreur sauvegarde');

      // Mise à jour locale en remplaçant l'entrée existante si elle existe
      setLocalHistory(prev => {
        const idx = prev.findIndex(f => f.id === archivedFlight.id && f.created_time === archivedFlight.created_time);
        if (idx !== -1) {
          const newArr = [...prev];
          newArr[idx] = {
            ...archivedFlight,
            _type: archivedFlight._type as "live" | "local" | "event" | undefined,
          };
          return newArr;
        }
        return [...prev, {
          ...archivedFlight,
          _type: archivedFlight._type as "live" | "local" | "event" | undefined,
        }];
      });
    } catch (e) {
      console.error("Erreur lors de l'enregistrement du vol archivé", e);
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

    if (selected._type === "live") {
      trace = liveTraces[selected.id]?.trace ?? [];
    } else if (selected._type === "local") {
      trace = (selected as any).trace ?? [];
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

    return [trace, selected._type === "event" ? trace : undefined];
  }, [selected, traces, liveTraces]);

  /** --- Récupération trace selon type de vol --- */
  const getTraceForFlight = useCallback(
    (flight: Flight): LatLng[] => {
      if (flight._type === "live") {
        return liveTraces[flight.id]?.trace ?? [];
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
    (flight: Flight) => (
      <button
        onClick={(e) => {
          e.stopPropagation();
          const rawTrace = getTraceForFlight(flight);
          openModal(flight, rawTrace);
        }}
      >
        Ancrer
      </button>
    ),
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
          flyToTrigger={flyToTrigger}
        />

        <TablesLayout
          error={dronesError}
          drones={dronesWithType}
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
          <div className="modal-map-capture" />
        </AnchorModalLayout>
      )}
    </div>
  );
}
