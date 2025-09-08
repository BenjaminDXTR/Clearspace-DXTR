import { useCallback } from "react";
import type {
  Flight,
  Event,
  IsAnchoredFn,
  RenderAnchorCellFn,
  HandleSelectFn,
} from "../../types/models";
import { prettyValue } from "../../utils/format";
import Pagination from "../common/Pagination";
import "./TablesLayout.css";

interface TablesLayoutProps {
  drones: Flight[];
  error: string | null;
  LIVE_FIELDS: string[];
  localPage: number;
  localMaxPage: number;
  setLocalPage: (page: number) => void;
  localPageData: Flight[];
  isAnchored: IsAnchoredFn;
  renderAnchorCell?: RenderAnchorCellFn;
  apiPage: number;
  apiMaxPage: number;
  setApiPage: (page: number) => void;
  apiPageData: Event[];
  HISTORY_API_FIELDS: string[];
  handleSelect: HandleSelectFn;
  debug?: boolean;
}

export default function TablesLayout({
  drones,
  error,
  LIVE_FIELDS,
  localPage,
  localMaxPage,
  setLocalPage,
  localPageData,
  renderAnchorCell,
  apiPage,
  apiMaxPage,
  setApiPage,
  apiPageData,
  HISTORY_API_FIELDS,
  handleSelect,
  debug = process.env.NODE_ENV === "development",
}: TablesLayoutProps) {
  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  const makeKey = (
    item: { id?: string | number; created_time?: string },
    index: number
  ): string =>
    `${item.id || "noid"}_${item.created_time || "notime"}_${index}`;

  const onSelect = useCallback(
    (flight: Flight) => {
      dlog("[TablesLayout] Sélection du vol :", flight);
      handleSelect(flight);
    },
    [handleSelect, debug]
  );

  const renderTable = (
    title: string,
    fields: string[],
    data: (Flight | Event)[],
    showAnchor: boolean = false
  ) => (
    <div className="table-container">
      <h2 className="table-title">{title}</h2>
      {data.length === 0 ? (
        <div className="table-empty">Aucune donnée à afficher.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field} scope="col">
                  {field}
                </th>
              ))}
              {showAnchor && <th scope="col">Ancrage</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => (
              <tr
                key={makeKey(item, idx)}
                tabIndex={0}
                className="clickable-row"
                onClick={() => onSelect(item as Flight)}
              >
                {fields.map((field) => (
                  <td key={field}>
                    {prettyValue(field, (item as any)[field])}
                  </td>
                ))}
                {showAnchor && renderAnchorCell && (
                  <td className="anchor-cell">
                    {renderAnchorCell(item as Flight)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="tables-layout">
      {error && <div className="error">{error}</div>}

      {/* Live table avec bouton Ancrer */}
      {renderTable("Détection en direct", LIVE_FIELDS, drones, true)}

      {/* Local history */}
      {renderTable("Vols archivés (local)", LIVE_FIELDS, localPageData, true)}
      <Pagination
        page={localPage}
        maxPage={localMaxPage}
        onPageChange={setLocalPage}
        debug={debug}
      />

      {/* API history */}
      {renderTable(
        "Événements historiques (API)",
        HISTORY_API_FIELDS,
        apiPageData,
        false // Pas d’ancrage direct ici sauf si on le souhaite plus tard
      )}
      <Pagination
        page={apiPage}
        maxPage={apiMaxPage}
        onPageChange={setApiPage}
        debug={debug}
      />
    </div>
  );
}
