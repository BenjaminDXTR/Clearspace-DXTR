import { useState, useEffect, useRef } from "react";
import type { Flight, LatLng } from "../types/models";
import { isLatLng } from "../utils/coords";
import { config } from "../config";

interface UseLiveTracesOptions {
  inactiveTimeout?: number;
  cleanupInterval?: number;
  onArchiveFlight?: (droneId: string, trace: LatLng[]) => void;
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
    inactiveTimeout = config.inactiveTimeout, // Valeur par défaut depuis config (lié à .env)
    cleanupInterval = 2000,
    onArchiveFlight,
    onUpdateLiveFlight,
    debug = config.debug || config.environment === "development",
  }: UseLiveTracesOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, DroneTraceState>>({});

  const liveTracesRef = useRef(liveTraces);
  liveTracesRef.current = liveTraces;

  const dlog = (...args: any[]) => {
    if (debug) console.log("[useLiveTraces]", ...args);
  };

  // Mise à jour live des traces sur réception drones
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
  }, [drones, onUpdateLiveFlight, debug]);

  // Nettoyage et archivage des vols inactifs
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();

      setLiveTraces((prev) => {
        const updated = { ...prev };
        let changed = false;

        Object.entries(prev).forEach(([droneId, data]) => {
          if (
            data.etatLive &&
            data.lastSeen &&
            now - data.lastSeen > inactiveTimeout
          ) {
            dlog(`Drone ${droneId} inactif depuis plus de ${inactiveTimeout}ms → archivage`);
            if (onArchiveFlight) {
              onArchiveFlight(droneId, data.trace);
            }
            data.etatLive = false;
            changed = true;
            dlog(`Drone ${droneId} marqué inactif après archivage`);
          }
        });

        return changed ? updated : prev;
      });
    }, cleanupInterval);

    return () => clearInterval(intervalId);
  }, [inactiveTimeout, cleanupInterval, onArchiveFlight, debug]);

  return { liveTraces };
}
