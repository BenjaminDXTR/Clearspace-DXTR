import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { Flight } from "../types/models";
import { PER_PAGE } from "../utils/constants";
import { config } from "../config";

interface UseLocalHistoryOptions {
  pollInterval?: number; // not used currently, kept for backward compatibility
  debug?: boolean;
  onUserError?: (msg: string) => void; // user-visible errors
}

export default function useLocalHistory({
  pollInterval = 0,
  debug = config.debug || config.environment === "development",
  onUserError
}: UseLocalHistoryOptions = {}) {
  const [localHistory, setLocalHistory] = useState<Flight[]>([]);
  const [localPage, setLocalPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manualUpdatesRef = useRef(new Map<string, Flight>());

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useLocalHistory]", ...args);
  }, [debug]);

  // Merging fresh flights into local cache
  const mergeFlights = useCallback((local: Flight[], fresh: Flight[]) => {
    const freshMap = new Map(fresh.map(f => [f.id + (f.created_time ?? ""), f]));
    const merged = local.map(flight => {
      const key = flight.id + (flight.created_time ?? "");
      if (freshMap.has(key)) {
        return freshMap.get(key)!;
      }
      return flight;
    });
    fresh.forEach(flight => {
      const key = flight.id + (flight.created_time ?? "");
      if (!merged.some(f => (f.id + (f.created_time ?? "")) === key)) {
        merged.push(flight);
      }
    });
    return merged;
  }, []);

  const setLocalHistoryWithMerge = useCallback((updater: (current: Flight[]) => Flight[]) => {
    setLocalHistory(old => {
      try {
        const updated = updater(old);
        updated.forEach(flight => {
          manualUpdatesRef.current.set(flight.id + (flight.created_time ?? ""), flight);
        });
        dlog(`Updated local history cache with ${updated.length} flights`);
        return updated;
      } catch (e) {
        const msg = `Error merging local history: ${(e as Error).message}`;
        dlog(msg);
        if (onUserError) onUserError(msg);
        return old;
      }
    });
  }, [dlog, onUserError]);

  const setLocalHistoryManual = useCallback((flights: Flight[]) => {
    const filtered = flights.filter(f => f._type === "local");
    setLocalHistoryWithMerge(() => filtered);
    setLocalPage(1);
  }, [setLocalHistoryWithMerge]);

  // Pagination
  const localMaxPage = useMemo(() => Math.max(1, Math.ceil(localHistory.length / PER_PAGE)), [localHistory]);
  const localPageData = useMemo(() => localHistory.slice((localPage - 1) * PER_PAGE, localPage * PER_PAGE), [localHistory, localPage]);

  return {
    localHistory,
    setLocalHistory: setLocalHistoryManual,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    loading,
    error,
  };
}
