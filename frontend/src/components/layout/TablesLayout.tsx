import { useCallback, useMemo } from "react";
import type {
  Flight,
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
  handleSelect: HandleSelectFn;
  debug?: boolean;
}

const DEBUG = config.debug || config.environment === "development";

function dlog(...args: unknown[]) {
  if (DEBUG) {
    // Limitation simple : ne log que si message ne contient pas "Nombre drones live filtrés" ou "Nombre drones archivés filtrés"
    const skipPatterns = [
      "Nombre drones live filtrés",
      "Nombre drones archivés filtrés",
      "Rendu tableau"
    ];
    if (!skipPatterns.some(pat => args.some(arg => typeof arg === "string" && arg.includes(pat)))) {
      console.log(...args);
    }
  }
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
  handleSelect,
  debug = config.debug || config.environment === "development",
}: TablesLayoutProps) {
  const onSelect = useCallback(
    (flight: Flight) => {
      dlog(`Vol sélectionné id=${flight.id ?? "?"}`);
      handleSelect(flight);
    },
    [handleSelect]
  );

  const genKey = (item: { id?: string | number; created_time?: string | number }, idx: number): string =>
    `${item.id ?? "noid"}_${item.created_time ?? "notime"}_${idx}`;

  const liveDrones = useMemo(() => {
    const filtered = drones.filter(
      d => d._type === "live" && d.id && d.latitude !== 0 && d.longitude !== 0
    );
    dlog(`Nombre drones live filtrés: ${filtered.length}`);
    return filtered;
  }, [drones]);

  const archivedDrones = useMemo(() => {
    const filtered = localPageData.filter(
      d => d._type === "local" && d.id && d.latitude !== 0 && d.longitude !== 0
    );
    dlog(`Nombre drones archivés filtrés: ${filtered.length}`);
    return filtered;
  }, [localPageData]);

  const renderTable = (
    title: string,
    fields: string[] | undefined,
    data: Flight[],
    withAnchor = false
  ) => {
    const safeFields = fields ?? [];
    dlog(`Rendu tableau "${title}" avec ${data.length} lignes et ${safeFields.length} colonnes`);
    return (
      <section className="table-container" aria-label={title}>
        <h2 className="table-title">{title}</h2>
        {data.length === 0 ? (
          <p className="table-empty">Aucun vol.</p>
        ) : (
          <table className="data-table" role="grid">
            <thead>
              <tr>
                {safeFields.map((field) => (
                  <th key={field} scope="col">{field}</th>
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
                  onClick={() => onSelect(item)}
                  aria-selected="false"
                >
                  {safeFields.map((field) => (
                    <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                  ))}
                  {withAnchor && renderAnchorCell && (
                    <td className="anchor-cell">{renderAnchorCell(item)}</td>
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
    </div>
  );
}
