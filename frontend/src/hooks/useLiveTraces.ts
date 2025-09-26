import { useState, useEffect, useRef, useCallback } from "react";
import type { Flight, LatLng } from "../types/models";
import { isLatLng } from "../utils/coords";
import { config } from "../config";

interface UseLiveTracesOptions {
  inactiveTimeout?: number;
  cleanupInterval?: number;
  onUpdateLiveFlight?: (flight: Flight, trace: LatLng[]) => void;
  debug?: boolean;
}

interface DroneTraceState {
  flight: Flight;
  trace: LatLng[];
  etatLive: boolean;
  lastSeen: number;
}

export default function useLiveTraces(
  drones: Flight[],
  {
    inactiveTimeout = config.inactiveTimeout,
    cleanupInterval = 2000,
    onUpdateLiveFlight,
    debug = config.debug || config.environment === "development",
  }: UseLiveTracesOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, DroneTraceState>>({});

  const liveTracesRef = useRef(liveTraces);
  liveTracesRef.current = liveTraces;

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useLiveTraces]", ...args);
  }, [debug]);

  // Met à jour les traces en fonction des drones reçus
  useEffect(() => {
    if (drones.length && debug) {
      dlog(`Mise à jour avec ${drones.length} drone(s)`);
    }
    const now = Date.now();

    setLiveTraces((prev) => {
      const updated = { ...prev };
      drones.forEach((drone) => {
        if (drone.id && isLatLng([drone.latitude, drone.longitude])) {
          const pt: LatLng = [Number(drone.latitude), Number(drone.longitude)];
          if (!updated[drone.id]) {
            updated[drone.id] = { flight: drone, trace: [], etatLive: true, lastSeen: now };
          }
          const trace = updated[drone.id].trace;
          const last = trace[trace.length - 1];
          if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
            updated[drone.id].trace = [...trace, pt];
            dlog(`Drone ${drone.id}: ajout point (${pt[0]},${pt[1]})`);
          }
          updated[drone.id].etatLive = true;
          updated[drone.id].lastSeen = now;
          updated[drone.id].flight = drone;

          if (onUpdateLiveFlight) {
            onUpdateLiveFlight({ ...drone, _type: "live" }, updated[drone.id].trace);
          }
        }
      });
      return updated;
    });
  }, [drones, onUpdateLiveFlight, dlog]);

  // Nettoyage des traces / repose uniquement sur mise à jour et inactiveTimeout (pas d’archivage)
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();

      setLiveTraces((prev) => {
        const updated = { ...prev };
        let changed = false;

        Object.entries(prev).forEach(([droneId, data]) => {
          const elapsed = now - data.lastSeen;
          dlog(`Drone ${droneId} - Inactivité durée: ${elapsed} ms, Timeout: ${inactiveTimeout} ms`);
          if (data.etatLive && data.lastSeen && elapsed > inactiveTimeout) {
            dlog(`Drone ${droneId} inactif depuis plus de ${inactiveTimeout}ms → marquage inactif`);
            data.etatLive = false;
            changed = true;
            dlog(`Drone ${droneId} marqué inactif`);
          }
        });

        return changed ? updated : prev;
      });
    }, cleanupInterval);

    return () => clearInterval(intervalId);
  }, [inactiveTimeout, cleanupInterval, dlog]);

  return { liveTraces };
}
