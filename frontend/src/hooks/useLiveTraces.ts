// src/hooks/useLiveTraces.ts
import { useState, useEffect, useCallback } from "react";
import type { Flight, LatLng, LatLngTimestamp } from "../types/models";
import { config } from "../config";
import { isEqual } from "lodash";
import useDebugLogger from "./useDebugLogger";

interface UseLiveTracesOptions {
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
  { onUpdate, onUserError, debug = config.debug || config.environment === "development" }: UseLiveTracesOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, DroneTraceState>>({});

  const dlog = useDebugLogger(debug, "useLiveTraces");

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

          const newTrace = Array.isArray(drone.trace) ? drone.trace : [];
          const prevTrace = updated[drone.id]?.trace ?? [];
          const prevFlight = updated[drone.id]?.flight ?? {};

          // On force la mise à jour sur vol waiting OU si trace ou vol ont changé
          if (drone.state === "waiting" || !isEqual(newTrace, prevTrace) || !isEqual(drone, prevFlight)) {
            updated[drone.id] = { flight: drone, trace: newTrace };
            changed = true;
            dlog(`[useLiveTraces] Updated drone id=${drone.id} state=${drone.state} with trace points=${newTrace.length}`);
            if (onUpdate) onUpdate(drone, newTrace);
          } else {
            dlog(`[useLiveTraces] No update needed for drone id=${drone.id} state=${drone.state}`);
          }
        });

        return changed ? updated : prev;
      });
    } catch (e) {
      const msg = `useLiveTraces error: ${(e as Error).message}`;
      dlog(msg);
      if (onUserError) onUserError(msg);
    }
  }, [drones, onUpdate, onUserError, dlog, debug]);

  return { liveTraces };
}
