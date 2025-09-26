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
import { config } from "../../config";
import "./TablesLayout.css";

interface TablesLayoutProps {
  drones: Flight[];
  error: string | null;
  LIVE_FIELDS: string[];
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[];
  isAnchored: IsAnchoredFn;
  renderAnchorCell?: RenderAnchorCellFn;
  apiPage: number;
  setApiPage: (page: number) => void;
  apiMaxPage: number;
  apiPageData: Event[];
  HISTORY_API_FIELDS: string[]; // renommé ici
  handleSelect: HandleSelectFn;
  debug?: boolean;
}

export default function TablesLayout({
  drones,
  error,
  LIVE_FIELDS,
  localPage,
  setLocalPage,
  localMaxPage,
  localPageData,
  isAnchored,
  renderAnchorCell,
  apiPage,
  setApiPage,
  apiMaxPage,
  apiPageData,
  HISTORY_API_FIELDS, // renommé ici
  handleSelect,
  debug = config.debug || config.environment === "development",
}: TablesLayoutProps) {
  const onSelect = useCallback(
    (flight: Flight) => {
      handleSelect(flight);
    },
    [handleSelect]
  );

  const genKey = (item: { id?: string | number; created_time?: string }, idx: number): string =>
    `${item.id ?? "noid"}_${item.created_time ?? "notime"}_${idx}`;

  const liveDrones = drones.filter((d) => d._type === "live");
  const archivedDrones = localPageData.filter((d) => d._type === "local");

  const renderTable = (
    title: string,
    fields: string[] | undefined,
    data: (Flight | Event)[],
    withAnchor = false
  ) => {
    const safeFields = fields ?? [];
    return (
      <section className="table-container" aria-label={title}>
        <h2 className="table-title">{title}</h2>
        {data.length === 0 ? (
          <p className="table-empty">Aucune donnée à afficher.</p>
        ) : (
          <table className="data-table" role="grid">
            <thead>
              <tr>
                {safeFields.map((field) => (
                  <th key={field} scope="col">
                    {field}
                  </th>
                ))}
                {withAnchor && <th scope="col">Ancrage</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr
                  key={genKey(item, idx)}
                  tabIndex={0}
                  className="clickable-row"
                  onClick={() => onSelect(item as Flight)}
                  aria-selected="false"
                >
                  {safeFields.map((field) => (
                    <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                  ))}
                  {withAnchor && renderAnchorCell && (
                    <td className="anchor-cell">{renderAnchorCell(item as Flight)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    );
  };

  return (
    <div className="tables-layout">
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}

      {renderTable("Détection en direct", LIVE_FIELDS, liveDrones, true)}

      {renderTable("Vols archivés (local)", LIVE_FIELDS, archivedDrones, true)}
      <Pagination
        page={localPage}
        maxPage={localMaxPage}
        onPageChange={setLocalPage}
        debug={debug}
      />

      {renderTable("Événements historiques (API)", HISTORY_API_FIELDS, apiPageData, false)}
      <Pagination
        page={apiPage}
        maxPage={apiMaxPage}
        onPageChange={setApiPage}
        debug={debug}
      />
    </div>
  );
}
