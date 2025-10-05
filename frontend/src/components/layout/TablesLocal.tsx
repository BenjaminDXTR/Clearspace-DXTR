import { useCallback, useMemo, useEffect } from "react";
import type { Flight, IsAnchoredFn, RenderAnchorCellFn, HandleSelectFn } from "../../types/models";
import { prettyValue } from "../../utils/format";
import { config } from "../../config";
import Pagination from "../common/Pagination";
import "./TablesLocal.css";

interface TablesLocalProps {
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[];
  LOCAL_FIELDS: string[];
  isAnchored: IsAnchoredFn;
  renderAnchorCell?: RenderAnchorCellFn;
  handleSelect: HandleSelectFn;
  openModal: (flight: Flight, trace: any[]) => void; // ajoute cette prop
  getTraceForFlight: (flight: Flight) => any[]; // ajoute cette prop
  debug?: boolean;
}

const DEBUG = config.debug || config.environment === "development";

function dlog(...args: unknown[]) {
  if (DEBUG) {
    const skipPatterns = ["Nombre drones archivés filtrés", "Rendu tableau"];
    if (!skipPatterns.some((pat) => args.some((arg) => typeof arg === "string" && arg.includes(pat)))) {
      console.log(...args);
    }
  }
}

export default function TablesLocal({
  localPage,
  setLocalPage,
  localMaxPage,
  localPageData,
  LOCAL_FIELDS,
  isAnchored,
  renderAnchorCell,
  handleSelect,
  openModal,
  getTraceForFlight,
  debug = DEBUG,
}: TablesLocalProps) {
  useEffect(() => {
    console.log("TablesLocal localPageData prop:", localPageData);
  }, [localPageData]);

  const onSelect = useCallback(
    (flight: Flight) => {
      dlog(`Vol sélectionné id=${flight.id ?? "?"}`);
      handleSelect(flight);
    },
    [handleSelect]
  );

  const genKey = (item: { id?: string | number; created_time?: string | number }, idx: number) =>
    `${item.id ?? "noid"}_${item.created_time ?? "notime"}_${idx}`;

  const archivedDrones = useMemo(() => {
    const filtered = localPageData.filter(
      (d) => d.type === "local" && d.id && d.latitude !== 0 && d.longitude !== 0
    );
    dlog(`Nombre drones archivés filtrés: ${filtered.length}`);
    return filtered;
  }, [localPageData]);

  return (
    <section className="table-container" aria-label="Vols archivés (local)">
      <h2 className="table-title">Vols archivés (local)</h2>
      {archivedDrones.length === 0 ? (
        <p className="table-empty">Aucun vol.</p>
      ) : (
        <>
          <table className="data-table" role="grid">
            <thead>
              <tr>
                {LOCAL_FIELDS.map((field) => (
                  <th key={field} scope="col">{field}</th>
                ))}
                <th scope="col">Ancrage</th>
              </tr>
            </thead>
            <tbody>
              {archivedDrones.map((item, idx) => {
                const anchored = isAnchored(item.id ?? "", item.created_time ?? "");
                return (
                  <tr
                    key={genKey(item, idx)}
                    tabIndex={0}
                    className={`clickable-row ${anchored ? "anchored" : ""}`}
                    onClick={() => onSelect(item)}
                    aria-selected="false"
                  >
                    {LOCAL_FIELDS.map((field) => (
                      <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                    ))}
                    <td className="anchor-cell">
                      {anchored ? (
                        "✔️"
                      ) : (
                        renderAnchorCell ? (
                          renderAnchorCell(item)
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const trace = getTraceForFlight(item);
                              openModal(item, trace);
                            }}
                            aria-label="Ancrer ce vol"
                          >
                            Ancrer
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            page={localPage}
            maxPage={localMaxPage}
            onPageChange={setLocalPage}
            debug={debug}
          />
        </>
      )}
    </section>
  );
}
