import { useState, useEffect, useCallback } from "react";
import type { Flight, LatLng } from "../types/models";
import { isLatLng } from "../utils/coords";
import { config } from "../config";

interface UseLiveTracesOptions {
  onUpdateLiveFlight?: (flight: Flight, trace: LatLng[]) => void;
  debug?: boolean;
}

interface DroneTraceState {
  flight: Flight;
  trace: LatLng[];
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
        if (drone.id && isLatLng([drone.latitude, drone.longitude])) {
          if (!updated[drone.id]) {
            updated[drone.id] = { flight: drone, trace: [] };
            hasChange = true;
            dlog(`Nouveau drone ajouté ${drone.id}`);
          }

          if (Array.isArray(drone.trace) && drone.trace.length > 0) {
            const filteredTrace = drone.trace.filter(isLatLng);
            if (
              JSON.stringify(filteredTrace) !== JSON.stringify(updated[drone.id].trace)
            ) {
              updated[drone.id].trace = filteredTrace;
              hasChange = true;
              dlog(`Trace drone ${drone.id} mise à jour : ${updated[drone.id].trace.length} points`);
            }
          } else {
            const currentTrace = updated[drone.id].trace;
            const pt: LatLng = [Number(drone.latitude), Number(drone.longitude)];
            const last = currentTrace[currentTrace.length - 1];
            if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
              updated[drone.id].trace = [...currentTrace, pt];
              hasChange = true;
              dlog(`Drone ${drone.id} fallback ajout point (${pt[0]},${pt[1]})`);
            }
          }

          if (JSON.stringify(drone) !== JSON.stringify(updated[drone.id].flight)) {
            updated[drone.id].flight = drone;
            hasChange = true;
          }

          if (onUpdateLiveFlight && hasChange) {
            onUpdateLiveFlight({ ...drone, _type: "live" }, updated[drone.id].trace);
          }
        }
      });
      return hasChange ? updated : prev;
    });
  }, [drones, onUpdateLiveFlight, dlog]);

  return { liveTraces };
}
