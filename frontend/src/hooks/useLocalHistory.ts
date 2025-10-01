import { useState, useEffect, useMemo, useCallback } from "react";
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

  useEffect(() => {
    if (!currentHistoryFile) {
      setLocalHistoryState([]);
      setLocalPage(1);
      setError(null);
      setLoading(false);
      dlog("No current history file selected");
      return;
    }
    (async () => {
      try {
        setLoading(true);
        dlog(`Loading history file: ${currentHistoryFile}`);
        const flights = await fetchHistory(currentHistoryFile);
        setLocalHistoryState(flights);
        setLocalPage(1);
        setError(null);
        dlog(`Loaded ${flights.length} flights from history`);
      } catch (e) {
        const msg = `Error loading history: ${(e as Error).message}`;
        setError(msg);
        setLocalHistoryState([]);
        setLocalPage(1);
        dlog(msg);
        if (onUserError) onUserError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentHistoryFile, fetchHistory, dlog, onUserError]);

  useEffect(() => {
    if (historyFiles.length === 0) {
      setCurrentHistoryFile(null);
      setLocalHistoryState([]);
      setLocalPage(1);
      setError(null);
      dlog("No history files available");
    } else if (!currentHistoryFile || !historyFiles.includes(currentHistoryFile)) {
      const latestFile = historyFiles[historyFiles.length - 1];
      setCurrentHistoryFile(latestFile);
      dlog(`Initial currentHistoryFile set to ${latestFile}`);
    }
  }, [historyFiles, currentHistoryFile, dlog]);

  const setLocalHistory = useCallback((flights: Flight[]) => {
    setLocalHistoryState(flights);
    setLocalPage(1);
    dlog(`Local history manually set, count: ${flights.length}`);
  }, [dlog]);

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
