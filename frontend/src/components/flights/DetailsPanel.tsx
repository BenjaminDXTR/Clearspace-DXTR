import { useEffect, useMemo } from "react";
import { formatDate } from "../../utils/format";
import type { Flight, LatLng } from "../../types/models";
import { config } from "../../config";
import "./DetailsPanel.css";

const IMPORTANT_FIELDS: string[] = [
  "id", "name", "created_time", "lastseen_time",
  "drone_type", "altitude", "latitude", "longitude",
  "distance", "speed", "state", "confirmed",
];

interface DetailsPanelProps {
  selected?: Flight | null;
  detailFields?: string[];
  exportObj: (obj: Flight) => void;
  selectedTraceRaw?: unknown;
  selectedTracePoints?: LatLng[] | null;
  debug?: boolean;
}

export default function DetailsPanel({
  selected,
  detailFields = [],
  exportObj,
  selectedTraceRaw,
  selectedTracePoints,
  debug = config.debug || config.environment === "development",
}: DetailsPanelProps) {
  const dlog = (...args: unknown[]) => {
    if (debug) console.log("[DetailsPanel]", ...args);
  };

  // Gestion nullable sécurisée
  const tracePoints = selectedTracePoints ?? [];

  useEffect(() => {
    if (selected) {
      dlog(`Vol sélectionné id=${selected.id} avec ${detailFields.length} champs`);
      dlog(`Trace sélectionnée points count = ${tracePoints.length}`);
      if (selectedTraceRaw != null) dlog("Trace brute (selectedTraceRaw) présente");
    } else {
      dlog("Aucun vol sélectionné");
    }
  }, [selected, detailFields, tracePoints, selectedTraceRaw, dlog]);

  if (!selected) {
    return (
      <div className="details-panel">
        <h3>Détails</h3>
        <p>Sélectionnez un vol pour voir les détails.</p>
      </div>
    );
  }

  const safeStringify = (val: unknown) => {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return "[Erreur de conversion JSON]";
    }
  };

  const showTracePoints = tracePoints.length > 0;

  const sortedFields = useMemo(() =>
    [
      ...IMPORTANT_FIELDS.filter(f => detailFields.includes(f)),
      ...detailFields.filter(f => !IMPORTANT_FIELDS.includes(f)),
    ],
    [detailFields]
  );

  const renderPointsList = (points: LatLng[], label: string) => (
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

      <table className="details-table">
        <tbody>
          {sortedFields.map(field => {
            const value = (selected as any)[field];
            if (value === undefined || value === null) return null;
            return (
              <tr key={field}>
                <td className="details-label">{field}</td>
                <td className="details-value">
                  {typeof value === "object"
                    ? <pre className="table-cell-pre">{safeStringify(value)}</pre>
                    : field.toLowerCase().includes("time")
                      ? formatDate(value)
                      : String(value)
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="details-actions">
        <button
          aria-label="Exporter les détails"
          onClick={() => {
            dlog(`Export JSON vol id=${selected.id}`);
            exportObj(selected);
          }}
        >
          Exporter JSON
        </button>
      </div>

      {showTracePoints && renderPointsList(tracePoints, "Points du vol :")}

      {selectedTraceRaw != null && (
        <section className="raw-trace-section">
          <h4>Tracé brut (JSON) :</h4>
          <pre className="raw-trace-pre">{safeStringify(selectedTraceRaw)}</pre>
        </section>
      )}
    </div>
  );
}
