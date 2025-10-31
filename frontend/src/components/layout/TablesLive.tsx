import { useCallback, useMemo, useEffect } from "react";
import type { Flight, HandleSelectFn } from "../../types/models";
import { prettyValue } from "../../utils/format";
import { config } from "../../config";
import "./TablesLayout.css";
import "./TablesLive.css";

interface SelectedKey {
  id?: string | number;
  created_time?: string | number;
}

interface TablesLiveProps {
  drones: Flight[];
  LIVE_FIELDS: string[];
  handleSelect: HandleSelectFn;
  selectedKey?: SelectedKey | null;  // Utilisation de selectedKey au lieu de selectedId
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
  handleSelect,
  selectedKey = null,
  debug = DEBUG,
}: TablesLiveProps) {
  useEffect(() => {
    console.log(`[TablesLive][${new Date().toISOString()}] drones prop:`, drones);

    const waitingFlights = drones.filter((d) => d.state === "waiting");
    console.log(
      `[TablesLive][${new Date().toISOString()}] Vols en état 'waiting' reçus: ${waitingFlights.length}`,
      waitingFlights
    );
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
      (d) =>
        (d.state === "live" || d.state === "waiting") &&
        d.id &&
        d.latitude !== 0 &&
        d.longitude !== 0
    );
    dlog(`[TablesLive][${new Date().toISOString()}] Nombre drones live ou waiting filtrés: ${filtered.length}`);
    return filtered;
  }, [drones, dlog]);

  return (
    <section className="table-container live" aria-label="Détection en direct">
      <h2 className="table-title">Détection en direct</h2>
      {liveDrones.length === 0 ? (
        <p className="table-empty">Aucun vol.</p>
      ) : (
        <table className="data-table live" role="grid">
          <thead>
            <tr>
              {LIVE_FIELDS.map((field) => (
                <th key={field} scope="col">
                  {field}
                </th>
              ))}
              <th scope="col">Statut</th>
            </tr>
          </thead>
          <tbody>
            {liveDrones.map((item, idx) => {
              const isSelected =
                selectedKey !== null &&
                item.id === selectedKey.id &&
                item.created_time === selectedKey.created_time;

              return (
                <tr
                  key={genKey(item, idx)}
                  tabIndex={0}
                  className={`clickable-row ${item.state === "waiting" ? "row-waiting" : ""} ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() => onSelect(item)}
                  aria-selected={isSelected}
                >
                  {LIVE_FIELDS.map((field) => (
                    <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                  ))}
                  <td className={`status-cell ${item.state === "waiting" ? "status-waiting" : "status-live"}`}>
                    {item.state === "waiting" ? "Waiting..." : "Live"}
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
