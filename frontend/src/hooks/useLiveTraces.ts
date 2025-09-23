import { useState, useEffect, useRef } from "react";
import type { Flight, LatLng } from "../types/models";
import { isLatLng } from "../utils/coords";
import { config } from "../config";

interface UseLiveTracesOptions {
  /** Durée avant archivage d'un vol inactif (ms) */
  inactiveTimeout?: number;
  /** Fréquence de nettoyage des vols inactifs (ms) */
  cleanupInterval?: number;
  /** Callback quand un vol est archivé */
  onArchiveFlight?: (droneId: string, trace: LatLng[]) => void;
  /** Activer les logs debug */
  debug?: boolean;
}

export default function useLiveTraces(
  drones: Flight[],
  {
    inactiveTimeout = 10000,
    cleanupInterval = 2000,
    onArchiveFlight,
    debug = config.debug || config.environment === "development",
  }: UseLiveTracesOptions = {}
) {
  const [liveTraces, setLiveTraces] = useState<Record<string, LatLng[]>>({});
  const [liveLastSeen, setLiveLastSeen] = useState<Record<string, number>>({});

  const liveTracesRef = useRef(liveTraces);
  const liveLastSeenRef = useRef(liveLastSeen);

  useEffect(() => {
    liveTracesRef.current = liveTraces;
  }, [liveTraces]);

  useEffect(() => {
    liveLastSeenRef.current = liveLastSeen;
  }, [liveLastSeen]);

  const dlog = (...args: any[]) => {
    if (debug) console.log("[useLiveTraces]", ...args);
  };

  // Mise à jour des traces et dernières positions vues
  useEffect(() => {
    if (drones.length && debug) {
      dlog(`Mise à jour avec ${drones.length} drone(s)`);
    }

    setLiveTraces((prev) => {
      const updated = { ...prev };
      drones.forEach((drone) => {
        if (drone.id && isLatLng([drone.latitude, drone.longitude])) {
          const pt: LatLng = [Number(drone.latitude), Number(drone.longitude)];
          if (!updated[drone.id]) updated[drone.id] = [];
          const trace = updated[drone.id];
          const last = trace[trace.length - 1];
          // Évite les doublons
          if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
            updated[drone.id] = [...trace, pt];
            dlog(`Drone ${drone.id} → nouveau point ajouté`);
          }
        }
      });
      return updated;
    });

    setLiveLastSeen((prev) => {
      const updated = { ...prev };
      drones.forEach((drone) => {
        if (drone.id && isLatLng([drone.latitude, drone.longitude])) {
          updated[drone.id] = Date.now();
        }
      });
      return updated;
    });
  }, [drones, debug]);

  // Nettoyage automatique des vols inactifs
  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();

      setLiveTraces((prevTraces) => {
        const updatedTraces = { ...prevTraces };
        let changed = false;

        Object.entries(prevTraces).forEach(([droneId, trace]) => {
          const lastSeen = liveLastSeenRef.current[droneId];
          if (
            trace.length > 1 &&
            lastSeen &&
            now - lastSeen > inactiveTimeout
          ) {
            dlog(`Drone ${droneId} inactif → archivage`);
            if (onArchiveFlight) {
              onArchiveFlight(droneId, trace);
            }
            delete updatedTraces[droneId];
            changed = true;
          }
        });

        return changed ? updatedTraces : prevTraces;
      });
    }, cleanupInterval);

    return () => clearInterval(intervalId);
  }, [inactiveTimeout, cleanupInterval, onArchiveFlight, debug]);

  return { liveTraces, liveLastSeen };
}
