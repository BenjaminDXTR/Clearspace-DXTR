import { useState, useEffect, useCallback } from "react";
import type { Flight, LatLng, LatLngTimestamp } from "../types/models";
import { config } from "../config";
import { isEqual } from "lodash";

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

  // Log helper
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
            if (debug) dlog("Ignored drone without id");
            if (onUserError) onUserError("Drones détectés sans ID - ignorés.");
            return;
          }

          // Normaliser la trace, doit être tableau, sinon tableau vide
          const newTrace = Array.isArray(drone.trace) ? drone.trace : [];

          // Précédentes traces stockées et vol pour comparaison
          const prevTrace = updated[drone.id]?.trace ?? [];
          const prevFlight = updated[drone.id]?.flight ?? {};

          // Comparaison profonde pour éviter mise à jour inutile
          if (!isEqual(newTrace, prevTrace) || !isEqual(drone, prevFlight)) {
            updated[drone.id] = { flight: drone, trace: newTrace };
            changed = true;
            dlog(`[useLiveTraces] Updated drone id=${drone.id} with trace points=${newTrace.length}`);
            if (onUpdate) onUpdate(drone, newTrace);
          } else {
            dlog(`[useLiveTraces] No update needed for drone id=${drone.id}`);
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
