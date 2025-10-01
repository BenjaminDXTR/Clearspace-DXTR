import { useState, useEffect, useCallback } from "react";
import type { Flight, LatLng, LatLngTimestamp } from "../types/models";
import { config } from "../config";

interface UseLiveTracesOptions {
  onUpdateLiveFlight?: (flight: Flight, trace: LatLng[] | LatLngTimestamp[]) => void;
  debug?: boolean;
}

interface DroneTraceState {
  flight: Flight;
  trace: LatLng[] | LatLngTimestamp[];
}

export default function useLiveTraces(
  drones: Flight[],
  {
    onUpdateLiveFlight,
    debug = config.debug || config.environment === "development",
  }: UseLiveTracesOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, DroneTraceState>>({});

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useLiveTraces]", ...args);
  }, [debug]);

  useEffect(() => {
    if (drones.length && debug) {
      dlog(`Mise à jour avec ${drones.length} drone(s)`);
    }

    setLiveTraces((prev) => {
      const updated = { ...prev };
      let hasChange = false;

      drones.forEach((drone) => {
        if (drone.id) {
          const traceFromBackend = Array.isArray(drone.trace) ? drone.trace : [];

          if (!updated[drone.id]) {
            updated[drone.id] = { flight: drone, trace: traceFromBackend };
            hasChange = true;
            dlog(`Nouveau drone ajouté ${drone.id} avec trace de ${traceFromBackend.length} points`);
          } else if (
            JSON.stringify(traceFromBackend) !== JSON.stringify(updated[drone.id].trace) ||
            JSON.stringify(drone) !== JSON.stringify(updated[drone.id].flight)
          ) {
            updated[drone.id] = { flight: drone, trace: traceFromBackend };
            hasChange = true;
            dlog(`Drone ${drone.id} mis à jour avec trace de ${traceFromBackend.length} points`);
          }

          if (onUpdateLiveFlight && hasChange) {
            onUpdateLiveFlight(drone, traceFromBackend);
          }
        }
      });

      return hasChange ? updated : prev;
    });
  }, [drones, onUpdateLiveFlight, dlog]);

  return { liveTraces };
}
