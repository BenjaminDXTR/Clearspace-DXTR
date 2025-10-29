import { useCallback, useEffect } from "react";
import type { Flight, IsAnchoredFn, RenderAnchorCellFn, HandleSelectFn } from "../../types/models";
import { prettyValue } from "../../utils/format";
import { config } from "../../config";
import Pagination from "../common/Pagination";
import HistoryFileSelector from "../common/HistoryFileSelector";
import "./TablesLayout.css";
import "./TablesLocal.css";

interface TablesLocalProps {
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[]; // Ici on attend que chaque vol ait anchorState déjà ajouté
  LOCAL_FIELDS: string[];
  isAnchored?: IsAnchoredFn; // optionnel car enrichi avant
  renderAnchorCell?: RenderAnchorCellFn;
  handleSelect: HandleSelectFn;
  openModal: (flight: Flight, trace: any[]) => void;
  getTraceForFlight: (flight: Flight) => any[];
  debug?: boolean;
  historyFiles: string[];
  currentFile: string | null;
  onSelectFile: (filename: string) => void;
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
  renderAnchorCell,
  handleSelect,
  openModal,
  getTraceForFlight,
  debug = DEBUG,
  historyFiles,
  currentFile,
  onSelectFile,
}: TablesLocalProps) {
  useEffect(() => {
    dlog("TablesLocal localPageData prop:", localPageData);
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

  return (
    <section className="table-container local" aria-label="Vols archivés (local)">
      <div className="history-selector-container">
        <HistoryFileSelector
          historyFiles={historyFiles}
          currentFile={currentFile}
          onSelectFile={onSelectFile}
        />
      </div>
      <h2 className="table-title">Vols archivés (local)</h2>
      {localPageData.length === 0 ? (
        <p className="table-empty">Aucun vol.</p>
      ) : (
        <>
          <table className="data-table local" role="grid">
            <thead>
              <tr>
                {LOCAL_FIELDS.map((field) => (
                  <th key={field} scope="col">
                    {field}
                  </th>
                ))}
                <th scope="col">Ancrage</th>
              </tr>
            </thead>
            <tbody>
              {localPageData.map((item, idx) => {
                // ATTENTION : anchorState enrichi en amont ; on ne fait plus l'appel isAnchored ici !
                const anchorState = (item as any).anchorState ?? "none";
                return (
                  <tr
                    key={genKey(item, idx)}
                    tabIndex={0}
                    className={`clickable-row ${
                      anchorState === "anchored"
                        ? "anchored"
                        : anchorState === "pending"
                        ? "pending"
                        : ""
                    }`}
                    onClick={() => onSelect(item)}
                    aria-selected="false"
                  >
                    {LOCAL_FIELDS.map((field) => (
                      <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                    ))}
                    <td className="anchor-cell">
                      {anchorState === "anchored" ? (
                        <>
                          ✔️ <span className="anchor-text">Ancré</span>
                        </>
                      ) : anchorState === "pending" ? (
                        <>
                          <button className="anchor-btn anchor-btn-disabled" disabled title="En attente d'ancrage">
                            ⏳En attente
                          </button>
                        </>
                      ) : renderAnchorCell ? (
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
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination page={localPage} maxPage={localMaxPage} onPageChange={setLocalPage} debug={debug} />
        </>
      )}
    </section>
  );
}

