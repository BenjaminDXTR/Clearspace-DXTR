import { useState, useEffect, useCallback } from "react";
import type { Flight, LatLng, LatLngTimestamp } from "../types/models";
import { config } from "../config";

interface UseLivetraceOptions {
  onUpdate?: (flight: Flight, trace: LatLng[] | LatLngTimestamp[]) => void;
  onUserError?: (message: string) => void;
  debug?: boolean;
}

interface DroneTraceState {
  flight: Flight;
  trace: LatLng[] | LatLngTimestamp[];
}

export default function useLiveTraces(
  drones: Flight[],
  { onUpdate, onUserError, debug = config.debug || config.environment === "development" }: UseLivetraceOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, DroneTraceState>>({});

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useLiveTraces]", ...args);
  }, [debug]);

  useEffect(() => {
    if (drones.length && debug) {
      dlog(`Update with ${drones.length} drones`);
    }
    try {
      setLiveTraces((prev) => {
        let changed = false;
        const updated = { ...prev };
        drones.forEach((drone) => {
          if (!drone.id) {
            // Log d'erreur seulement, pas de log répétitif
            if (debug) dlog("Ignored drone without id");
            if (onUserError) onUserError("Drones détectés sans ID - ignorés.");
            return;
          }
          const newTrace = Array.isArray(drone.trace) ? drone.trace : [];
          if (
            !updated[drone.id] ||
            JSON.stringify(newTrace) !== JSON.stringify(updated[drone.id].trace) ||
            JSON.stringify(drone) !== JSON.stringify(updated[drone.id].flight)
          ) {
            updated[drone.id] = { flight: drone, trace: newTrace };
            changed = true;
            // Suppression du log fréquent de chaque mise à jour drone
            // dlog(`Updated drone ${drone.id} with new trace length ${newTrace.length}`);
            if (changed && onUpdate) {
              onUpdate(drone, newTrace);
            }
          }
        });
        return changed ? updated : prev;
      });
    } catch (e) {
      const msg = `useLiveTraces error: ${(e as Error).message}`;
      dlog(msg);
      if (onUserError) onUserError(msg);
    }
  }, [drones, onUpdate, onUserError, dlog]);

  return { liveTraces };
}
