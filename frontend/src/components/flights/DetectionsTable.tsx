import { useEffect, MouseEvent, KeyboardEvent, useCallback } from "react";
import { prettyValue } from "../../utils/format";
import Pagination from "../common/Pagination";
import { config } from "../../config";
import { useDrones } from "../../contexts/DronesContext"; // import du contexte
import "./DetectionsTable.css";

interface Detection {
  id?: string | number;
  created_time?: string | number;
  saved_time?: string | number;
  [key: string]: any;
}

type Field = string;
type OnSelectFn = (detection: Detection, selectedType?: string) => void;
type IsAnchoredFn = (
  id: string | number | undefined,
  createdTime?: string | number
) => boolean;
type AnchorFlightFn = (detection: Detection) => void;
type RenderAnchorCellFn = (detection: Detection) => React.ReactNode;

interface DetectionsTableProps {
  fields: Field[];
  onSelect: OnSelectFn;
  isAnchored: IsAnchoredFn;
  anchorFlight: AnchorFlightFn;
  selectedType?: string;
  renderAnchorCell?: RenderAnchorCellFn;
  page?: number;
  maxPage?: number;
  onPageChange?: (page: number) => void;
  debug?: boolean;
}


export default function DetectionsTable({
  fields,
  onSelect,
  isAnchored,
  anchorFlight,
  selectedType,
  renderAnchorCell,
  page = 1,
  maxPage = 1,
  onPageChange,
  debug = config.debug || config.environment === "development",
}: DetectionsTableProps) {
  const dlog = (...args: unknown[]) => {
    if (debug) console.log("[DetectionsTable]", ...args);
  };

  // Prend les drones du contexte partagé au lieu de props.data
  const { drones: data } = useDrones();

  useEffect(() => {
    dlog(
      `[DetectionsTable] Rendu : ${data.length} ligne(s), champs : ${fields.join(", ")}`
    );
  }, [data, fields, dlog]);

  const handleRowClick = useCallback(
    (d: Detection) => {
      dlog(
        `[DetectionsTable] Sélection : id=${d.id ?? "?"}, type=${selectedType ?? "N/A"}`
      );
      onSelect(d, selectedType);
    },
    [onSelect, selectedType, dlog]
  );

  const handleAnchorClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>, d: Detection) => {
      e.stopPropagation();
      dlog(
        `[DetectionsTable] Clic "Ancrer" : id=${d.id ?? "?"}, type=${selectedType ?? "N/A"}`
      );
      anchorFlight(d);
    },
    [anchorFlight, selectedType, dlog]
  );

  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>, d: Detection) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowClick(d);
      }
    },
    [handleRowClick]
  );

  return (
    <div className="detections-table-wrapper">
      <table className="detections-table">
        <thead>
          <tr>
            {fields.map((f) => (
              <th key={f} scope="col">
                {f.replace(/_/g, " ")}
              </th>
            ))}
            <th scope="col">Ancrage</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => {
            const anchored = isAnchored(d.id, d.created_time);
            const rowKey = `${d.id ?? "?"}_${d.created_time || d.saved_time || ""}`;

            return (
              <tr
                key={rowKey}
                onClick={() => handleRowClick(d)}
                onKeyDown={(e) => handleRowKeyDown(e, d)}
                className={`detections-row ${
                  anchored ? "detections-row--anchored" : ""
                }`}
                tabIndex={0}
                aria-rowindex={i + 1}
                aria-label={`Sélectionner vol/détection id ${d.id ?? "?"}`}
              >
                {fields.map((f) => (
                  <td key={f}>{prettyValue(f, d[f])}</td>
                ))}
                <td className="anchor-cell">
                  {renderAnchorCell
                    ? renderAnchorCell(d)
                    : anchored
                    ? "✔️"
                    : (
                        <button
                          onClick={(e) => handleAnchorClick(e, d)}
                          aria-label={`Ancrer ce vol ${d.id ?? ""}`}
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

      {maxPage && maxPage > 1 && onPageChange && (
        <Pagination
          page={page!}
          maxPage={maxPage}
          onPageChange={onPageChange}
          debug={debug}
        />
      )}
    </div>
  );
}
