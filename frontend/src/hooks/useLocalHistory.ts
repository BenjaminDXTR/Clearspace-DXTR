// src/hooks/useLocalHistory.ts
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight } from "../types/models";
import { PER_PAGE } from "../utils/constants";
import useDebugLogger from "./useDebugLogger";

interface UseLocalHistoryOptions {
  fetchHistory: (filename: string) => Promise<Flight[]>;
  historyFiles: string[];
  refreshTrigger?: string | null;
  debug?: boolean;
  onUserError?: (msg: string) => void;
}

interface UseLocalHistoryResult {
  currentHistoryFile: string | null;
  setCurrentHistoryFile: (filename: string | null) => void;
  localHistory: Flight[];
  setLocalHistory: (flights: Flight[]) => void;
  localPage: number;
  setLocalPage: (page: number) => void;
  localMaxPage: number;
  localPageData: Flight[];
  error: string | null;
  loading: boolean;
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

async function fetchHistoryWithCacheBuster(fetchHistory: (filename: string) => Promise<Flight[]>, filename: string): Promise<Flight[]> {
  const urlWithTimestamp = `${filename}?t=${Date.now()}`;
  return fetchHistory(urlWithTimestamp);
}

export default function useLocalHistory({
  fetchHistory,
  historyFiles,
  refreshTrigger = null,
  debug = false,
  onUserError,
}: UseLocalHistoryOptions): UseLocalHistoryResult {
  const [currentHistoryFile, setCurrentHistoryFile] = useState<string | null>(null);
  const [localHistory, setLocalHistory] = useState<Flight[]>([]);
  const [localPage, setLocalPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const prevHistoryFileRef = useRef<string | null>(null);
  const prevRefreshTrigger = usePrevious(refreshTrigger);
  const log = useDebugLogger(debug, "useLocalHistory");

  useEffect(() => {
    if (!currentHistoryFile) {
      if (prevHistoryFileRef.current !== null) {
        setLocalHistory([]);
        setLocalPage(1);
        setError(null);
        setLoading(false);
        log("No current history file selected, cleared local history");
      }
      prevHistoryFileRef.current = null;
      return;
    }

    if (prevHistoryFileRef.current === currentHistoryFile && refreshCounter === 0) {
      log(`Same currentHistoryFile (${currentHistoryFile}) and no refresh, skipping fetch`);
      return;
    }

    prevHistoryFileRef.current = currentHistoryFile;

    (async () => {
      try {
        setLoading(true);
        log(`Fetching history file: ${currentHistoryFile}`);
        const flights = await fetchHistoryWithCacheBuster(fetchHistory, currentHistoryFile);
        log(`Received ${flights.length} flights for file ${currentHistoryFile}`);

        setLocalHistory([...flights]); // New reference for React update
        // IMPORTANT : Ne plus forcer setLocalPage(1) ici pour préserver la page courante
        setError(null);
      } catch (e) {
        const msg = `Error loading history file ${currentHistoryFile}: ${(e as Error).message}`;
        setError(msg);
        onUserError?.(msg);
        setLocalHistory([]);
        setLocalPage(1);
        log(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentHistoryFile, fetchHistory, onUserError, refreshCounter, debug, log]);

  useEffect(() => {
    if (
      refreshTrigger &&
      refreshTrigger === currentHistoryFile &&
      prevRefreshTrigger !== refreshTrigger
    ) {
      log(`Refresh triggered for current history file ${currentHistoryFile}`);
      setRefreshCounter(v => v + 1);
    }
  }, [refreshTrigger, currentHistoryFile, prevRefreshTrigger, log]);

  useEffect(() => {
    if (historyFiles.length === 0) {
      if (currentHistoryFile !== null) {
        setCurrentHistoryFile(null);
        setLocalHistory([]);
        setLocalPage(1);
        setError(null);
        log("No history files available, cleared current file");
      }
    } else {
      const latest = historyFiles[historyFiles.length - 1];
      if (currentHistoryFile !== latest) {
        log(`Set currentHistoryFile to latest: ${latest}`);
        setCurrentHistoryFile(latest);
      }
    }
  }, [historyFiles, currentHistoryFile, log]);

  const sortedLocalHistory = useMemo(() => {
    return [...localHistory]
      .filter(flight => flight.state === 'local')
      .sort((a, b) => {
        const dateA = new Date(a.created_time ?? "").getTime();
        const dateB = new Date(b.created_time ?? "").getTime();
        return dateB - dateA;
      });
  }, [localHistory]);

  const localMaxPage = useMemo(() => Math.max(1, Math.ceil(sortedLocalHistory.length / PER_PAGE)), [sortedLocalHistory]);

  const localPageData = useMemo(() => {
    const start = (localPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    return sortedLocalHistory.slice(start, end);
  }, [sortedLocalHistory, localPage]);

  const setLocalHistoryManual = useCallback((flights: Flight[]) => {
    setLocalHistory([...flights]);
    setLocalPage(1);
    log(`Manually set localHistory with ${flights.length} flights`);
  }, [log]);

  return {
    currentHistoryFile,
    setCurrentHistoryFile,
    localHistory,
    setLocalHistory: setLocalHistoryManual,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    error,
    loading,
  };
}
