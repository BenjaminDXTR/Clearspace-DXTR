import { useCallback, useMemo, useEffect } from "react";
import type { Flight, IsAnchoredFn, RenderAnchorCellFn, HandleSelectFn } from "../../types/models";
import { prettyValue } from "../../utils/format";
import { config } from "../../config";
import "./TablesLive.css";

interface TablesLiveProps {
  drones: Flight[];
  LIVE_FIELDS: string[];
  isAnchored: IsAnchoredFn;
  renderAnchorCell?: RenderAnchorCellFn;
  handleSelect: HandleSelectFn;
  debug?: boolean;
}

const DEBUG = config.debug || config.environment === "development";

function dlog(...args: unknown[]) {
  if (DEBUG) {
    const skipPatterns = ["Nombre drones live filtrés", "Rendu tableau"];
    if (!skipPatterns.some((pat) => args.some((arg) => typeof arg === "string" && arg.includes(pat)))) {
      console.log(...args);
    }
  }
}

export default function TablesLive({
  drones,
  LIVE_FIELDS,
  isAnchored,
  renderAnchorCell,
  handleSelect,
  debug = DEBUG,
}: TablesLiveProps) {
  useEffect(() => {
    console.log("TablesLive drones prop:", drones);
  }, [drones]);

  const onSelect = useCallback(
    (flight: Flight) => {
      dlog(`Vol sélectionné id=${flight.id ?? "?"}`);
      handleSelect(flight);
    },
    [handleSelect]
  );

  const genKey = (item: { id?: string | number; created_time?: string | number }, idx: number) =>
    `${item.id ?? "noid"}_${item.created_time ?? "notime"}_${idx}`;

  const liveDrones = useMemo(() => {
    const filtered = drones.filter(
      (d) => d.type === "live" && d.id && d.latitude !== 0 && d.longitude !== 0
    );
    dlog(`Nombre drones live filtrés: ${filtered.length}`);
    return filtered;
  }, [drones, dlog]);

  return (
    <section className="table-container" aria-label="Détection en direct">
      <h2 className="table-title">Détection en direct</h2>
      {liveDrones.length === 0 ? (
        <p className="table-empty">Aucun vol.</p>
      ) : (
        <table className="data-table" role="grid">
          <thead>
            <tr>
              {LIVE_FIELDS.map((field) => (
                <th key={field} scope="col">
                  {field}
                </th>
              ))}
              <th scope="col">Ancrage</th>
            </tr>
          </thead>
          <tbody>
            {liveDrones.map((item, idx) => {
              const anchored = isAnchored(item.id ?? "", item.created_time ?? "");
              return (
                <tr
                  key={genKey(item, idx)}
                  tabIndex={0}
                  className={`clickable-row ${anchored ? "anchored" : ""}`}
                  onClick={() => onSelect(item)}
                  aria-selected="false"
                >
                  {LIVE_FIELDS.map((field) => (
                    <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                  ))}
                  <td className="anchor-cell">
                    {anchored ? (
                      "✔️"
                    ) : renderAnchorCell ? (
                      renderAnchorCell(item)
                    ) : (
                      <button
                        onClick={(e) => e.stopPropagation()}
                        disabled={anchored}
                        aria-label={anchored ? "Vol déjà ancré" : "Ancrer ce vol"}
                      >
                        Ancrer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
