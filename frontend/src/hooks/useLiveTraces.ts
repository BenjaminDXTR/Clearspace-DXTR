import { useState, useEffect, useCallback } from "react";
import type { Flight, LatLng, LatLngTimestamp } from "../types/models";
import { config } from "../config";


interface UseLivetraceOptions {
  onUpdate?: (flight: Flight, trace: LatLng[] | LatLngTimestamp[]) => void;
  onUserError?: (message: string) => void; // Erreurs destinées à l'utilisateur
  debug?: boolean;
}


interface DroneTraceState {
  flight: Flight;
  trace: LatLng[] | LatLngTimestamp[];
}


export default function useLivetrace(
  drones: Flight[],
  {
    onUpdate,
    onUserError,
    debug = config.debug || config.environment === "development"
  }: UseLivetraceOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, DroneTraceState>>({});

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log("[useLivetrace]", ...args);
    }
  }, [debug]);

  useEffect(() => {
    if(drones.length && debug){
      dlog(`Update with ${drones.length} drone(s)`);
    }

    try {
      setLiveTraces((prev) => {
        const updated = { ...prev };
        let changed = false;

        drones.forEach(drone => {
          if(!drone.id){
            dlog("Ignored drone without id");
            if(onUserError){
              onUserError("Received drone without ID - ignored.");
            }
            return;
          }

          const newTrace = Array.isArray(drone.trace) ? drone.trace : [];

          // Compare previous stored trace and flight data as JSON strings for deep equality:
          if(!updated[drone.id]){
            updated[drone.id] = { flight: drone, trace: newTrace };
            changed = true;
            dlog(`Added new drone ${drone.id} with trace length ${newTrace.length}`);
          } else if(
              JSON.stringify(newTrace) !== JSON.stringify(updated[drone.id].trace) ||
              JSON.stringify(drone) !== JSON.stringify(updated[drone.id].flight)
            ){
            updated[drone.id] = { flight: drone, trace: newTrace };
            changed = true;
            dlog(`Updated drone ${drone.id} with new trace length ${newTrace.length}`);
          }

          if(changed && onUpdate){
            onUpdate(drone, newTrace);
          }
        });

        return changed ? updated : prev;
      });
    } catch(e){
      const msg = `Error in useLivetrace: ${(e as Error).message}`;
      dlog(msg);
      if(onUserError){
        onUserError(msg);
      }
    }
  }, [drones, onUpdate, onUserError, dlog]);

  return { liveTraces };
}
