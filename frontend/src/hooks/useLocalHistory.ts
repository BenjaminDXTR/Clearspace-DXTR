import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight } from "../types/models";
import { PER_PAGE } from "../utils/constants";

interface UseLocalHistoryOptions {
  fetchHistory: (filename: string) => Promise<Flight[]>;
  historyFiles: string[];
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

export default function useLocalHistory({
  fetchHistory,
  historyFiles,
  debug = false,
  onUserError,
}: UseLocalHistoryOptions): UseLocalHistoryResult {
  const [currentHistoryFile, setCurrentHistoryFile] = useState<string | null>(null);
  const [localHistory, setLocalHistoryState] = useState<Flight[]>([]);
  const [localPage, setLocalPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dlog = useCallback((...args: unknown[]) => {
    if (debug) console.log("[useLocalHistory]", ...args);
  }, [debug]);

  const prevHistoryFileRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentHistoryFile) {
      if (prevHistoryFileRef.current !== null) {
        setLocalHistoryState([]);
        setLocalPage(1);
        setError(null);
        setLoading(false);
        if (debug) dlog("No current history file selected");
      }
      prevHistoryFileRef.current = null;
      return;
    }

    if (prevHistoryFileRef.current === currentHistoryFile) {
      // Même fichier courant, ne rien faire
      return;
    }

    prevHistoryFileRef.current = currentHistoryFile;

    (async () => {
      try {
        setLoading(true);
        if (debug) dlog(`Loading history file: ${currentHistoryFile}`);
        const flights = await fetchHistory(currentHistoryFile);
        setLocalHistoryState(flights);
        setLocalPage(1);
        setError(null);
        if (debug) dlog(`Loaded ${flights.length} flights from history`);
      } catch (e) {
        const msg = `Error loading history: ${(e as Error).message}`;
        setError(msg);
        if (onUserError) onUserError(msg);
        setLocalHistoryState([]);
        setLocalPage(1);
        if (debug) dlog(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentHistoryFile, fetchHistory, dlog, onUserError, debug]);

  useEffect(() => {
    if (historyFiles.length === 0) {
      if (currentHistoryFile !== null) {
        setCurrentHistoryFile(null);
        setLocalHistoryState([]);
        setLocalPage(1);
        setError(null);
        if (debug) dlog("No history files available");
      }
    } else {
      const latestFile = historyFiles[historyFiles.length - 1];
      if (currentHistoryFile !== latestFile) {
        setCurrentHistoryFile(latestFile);
        if (debug) dlog(`Initial currentHistoryFile set to ${latestFile}`);
      }
    }
  }, [historyFiles, currentHistoryFile, dlog, debug]);

  const setLocalHistory = useCallback((flights: Flight[]) => {
    setLocalHistoryState(flights);
    setLocalPage(1);
    if (debug) dlog(`Local history manually set, count: ${flights.length}`);
  }, [dlog, debug]);

  const localMaxPage = useMemo(() => Math.max(1, Math.ceil(localHistory.length / PER_PAGE)), [localHistory]);
  const localPageData = useMemo(() => localHistory.slice((localPage - 1) * PER_PAGE, localPage * PER_PAGE), [localHistory, localPage]);

  return {
    currentHistoryFile,
    setCurrentHistoryFile,
    localHistory,
    setLocalHistory,
    localPage,
    setLocalPage,
    localMaxPage,
    localPageData,
    error,
    loading,
  };
}
