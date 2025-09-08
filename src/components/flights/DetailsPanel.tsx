import { useEffect, useMemo } from "react";
import { formatDate } from "../../utils/format";
import { getFlightTrace } from "../../utils/coords";
import type { Flight } from "../../types/models";
import type { LatLngTuple } from "leaflet";
import "./DetailsPanel.css";

// Champs importants affichés en priorité
const IMPORTANT_FIELDS: string[] = [
  "id", "name", "created_time", "lastseen_time",
  "drone_type", "altitude", "latitude", "longitude",
  "distance", "speed", "state", "confirmed",
];

interface DetailsPanelProps {
  selected?: Flight | null;
  detailFields?: string[];
  exportObj: (obj: Flight) => void;
  selectedTraceRaw?: any;
  selectedTracePoints?: LatLngTuple[];
  debug?: boolean;
}

export default function DetailsPanel({
  selected,
  detailFields = [],
  exportObj,
  selectedTraceRaw,
  selectedTracePoints = [],
  debug = process.env.NODE_ENV === "development",
}: DetailsPanelProps) {
  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  // Normalisation ID
  const normalizedSelected: Flight | null = selected
    ? { ...selected, id: selected.id ? String(selected.id) : "" }
    : null;

  useEffect(() => {
    if (normalizedSelected) {
      dlog(`[DetailsPanel] vol id=${normalizedSelected.id || "N/A"} - ${detailFields.length} champs`);
    } else {
      dlog("[DetailsPanel] aucun vol sélectionné");
    }
  }, [normalizedSelected, detailFields]);

  if (!normalizedSelected) {
    return (
      <div className="details-panel">
        <h3>Détails</h3>
        <p>Sélectionnez un vol pour voir les détails.</p>
      </div>
    );
  }

  // Points
  const localPoints: LatLngTuple[] = getFlightTrace(normalizedSelected);
  const apiPoints: LatLngTuple[] = Array.isArray(selectedTracePoints) ? selectedTracePoints : [];

  const showLocalPoints = normalizedSelected._type === "local" && localPoints.length > 0;
  const showApiPoints = normalizedSelected._type === "event" && apiPoints.length > 0;

  // Champs triés
  const sortedFields = useMemo(
    () => [
      ...IMPORTANT_FIELDS.filter(f => detailFields.includes(f)),
      ...detailFields.filter(f => !IMPORTANT_FIELDS.includes(f)),
    ],
    [detailFields]
  );

  const safeStringify = (val: unknown) => {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return "[Erreur de conversion JSON]";
    }
  };

  const renderPointsList = (points: LatLngTuple[], label: string) => (
    <section className="points-section">
      <h4>{label}</h4>
      <ol className="points-list">
        {points.map(([lat, lon], idx) => (
          <li key={idx}>lat: {lat.toFixed(6)}, lon: {lon.toFixed(6)}</li>
        ))}
      </ol>
    </section>
  );

  return (
    <div className="details-panel">
      <h3>Détails</h3>

      {/* Tableau des propriétés */}
      <table className="details-table">
        <tbody>
          {sortedFields.map((field) => {
            const value = (normalizedSelected as any)[field];
            if (value === undefined || value === null) return null;

            return (
              <tr key={field}>
                <td className="details-label">{field}</td>
                <td className="details-value">
                  {typeof value === "object"
                    ? <pre className="table-cell-pre">{safeStringify(value)}</pre>
                    : field.toLowerCase().includes("time")
                      ? formatDate(value)
                      : value.toString()
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bouton export */}
      <div className="details-actions">
        <button
          onClick={() => {
            dlog(`[DetailsPanel] Export JSON vol id=${normalizedSelected.id}`);
            exportObj(normalizedSelected);
          }}
          aria-label="Exporter les détails du vol en JSON"
        >
          Exporter JSON
        </button>
      </div>

      {/* Points locaux/API */}
      {showLocalPoints && renderPointsList(localPoints, "Points du vol (local) :")}
      {showApiPoints && renderPointsList(apiPoints, "Points du vol (API) :")}

      {/* Trace brut */}
      {selectedTraceRaw && (
        <section className="raw-trace-section">
          <h4>Tracé brut (JSON) :</h4>
          <pre className="table-cell-pre raw-trace-pre">
            {safeStringify(selectedTraceRaw)}
          </pre>
        </section>
      )}
    </div>
  );
}
