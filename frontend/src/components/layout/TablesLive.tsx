import { useCallback, useMemo, useEffect } from "react";
import type { Flight, HandleSelectFn } from "../../types/models";
import { prettyValue } from "../../utils/format";
import { config } from "../../config";
import "./TablesLive.css";

interface TablesLiveProps {
  drones: Flight[];
  LIVE_FIELDS: string[];
  handleSelect: HandleSelectFn;
  debug?: boolean;
}

const DEBUG = config.debug || config.environment === "development";

/**
 * Fonction de log conditionnel et filtré pour éviter trop de bruit
 * Filtre certains messages trop fréquents
 */
function dlog(...args: unknown[]) {
  if (DEBUG) {
    const skipPatterns = ["Nombre drones live filtrés", "Rendu tableau"];
    if (!skipPatterns.some((pat) => args.some((arg) => typeof arg === "string" && arg.includes(pat)))) {
      console.log(...args);
    }
  }
}

/**
 * Composant affichant le tableau des vols en direct
 * Affiche aussi les vols en état "waiting" avec un style distinctif
 */
export default function TablesLive({
  drones,
  LIVE_FIELDS,
  handleSelect,
  debug = DEBUG,
}: TablesLiveProps) {
  // Log à chaque changement de drones reçus
  useEffect(() => {
    console.log(`[TablesLive][${new Date().toISOString()}] drones prop:`, drones);

    // Log distinct des vols avec état 'waiting'
    const waitingFlights = drones.filter(d => d.state === "waiting");
    console.log(`[TablesLive][${new Date().toISOString()}] Vols en état 'waiting' reçus: ${waitingFlights.length}`, waitingFlights);
  }, [drones]);

  // Callback pour sélection d'un vol par l'utilisateur
  const onSelect = useCallback(
    (flight: Flight) => {
      dlog(`Vol sélectionné id=${flight.id ?? "?"}`);
      handleSelect(flight);
    },
    [handleSelect]
  );

  // Générateur de clés uniques pour les lignes du tableau
  const genKey = (item: { id?: string | number; created_time?: string | number }, idx: number) =>
    `${item.id ?? "noid"}_${item.created_time ?? "notime"}_${idx}`;

  // Filtrer les vols pour afficher live + waiting, exclure id manquant ou coord 0/0
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
              {/* Colonne état visible avec indicateur supplémentaire */}
              <th scope="col">Statut</th>
              {/* Suppression de la colonne 'Ancrage' comme demandé */}
            </tr>
          </thead>
          <tbody>
            {liveDrones.map((item, idx) => (
              <tr
                key={genKey(item, idx)}
                tabIndex={0}
                className={`clickable-row ${item.state === "waiting" ? "row-waiting" : ""}`}
                onClick={() => onSelect(item)}
                aria-selected="false"
              >
                {LIVE_FIELDS.map((field) => (
                  <td key={field}>{prettyValue(field, (item as any)[field])}</td>
                ))}

                {/* Nouvelle cellule Statut personnalisée */}
                <td className={`status-cell ${item.state === "waiting" ? "status-waiting" : "status-live"}`}>
                  {item.state === "waiting" ? "Waiting..." : "Live"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
