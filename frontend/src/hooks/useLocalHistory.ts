import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Flight } from "../types/models";
import { PER_PAGE } from "../utils/constants";

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

// Permet d’obtenir la valeur précédente d’une prop/state
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
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

  const prevHistoryFileRef = useRef<string | null>(null);
  const prevRefreshTrigger = usePrevious(refreshTrigger);

  const log = (...args: any[]) => debug && console.log("[useLocalHistory]", ...args);

  // Chargement du fichier historique
  useEffect(() => {
    if (!currentHistoryFile) {
      if (prevHistoryFileRef.current !== null) {
        setLocalHistory([]);
        setLocalPage(1);
        setError(null);
        setLoading(false);
        log("No current history file selected, cleared");
      }
      prevHistoryFileRef.current = null;
      return;
    }

    if (prevHistoryFileRef.current === currentHistoryFile) {
      log(`Same currentHistoryFile ${currentHistoryFile}, skip fetch`);
      return;
    }

    prevHistoryFileRef.current = currentHistoryFile;

    (async () => {
      try {
        setLoading(true);
        log(`Fetching history file: ${currentHistoryFile}`);
        const flights = await fetchHistory(currentHistoryFile);
        log(`Fetched ${flights.length} flights from ${currentHistoryFile}`);
        setLocalHistory(flights);
        setLocalPage(1);
        setError(null);
      } catch (e) {
        const msg = `Error loading history ${currentHistoryFile}: ${(e as Error).message}`;
        setError(msg);
        onUserError?.(msg);
        setLocalHistory([]);
        setLocalPage(1);
        log(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentHistoryFile, fetchHistory, onUserError]);

  // Rafraîchissement sur notification backend
  useEffect(() => {
    if (
      refreshTrigger &&
      refreshTrigger === currentHistoryFile &&
      prevRefreshTrigger !== refreshTrigger
    ) {
      log(`Refresh triggered for currentHistoryFile ${currentHistoryFile}, refreshing`);
      setCurrentHistoryFile(null);
      setTimeout(() => setCurrentHistoryFile(currentHistoryFile), 0);
    }
  }, [refreshTrigger, currentHistoryFile, prevRefreshTrigger]);

  // Mise à jour automatique du fichier courant à partir de la liste
  useEffect(() => {
    if (historyFiles.length === 0) {
      if (currentHistoryFile !== null) {
        setCurrentHistoryFile(null);
        setLocalHistory([]);
        setLocalPage(1);
        setError(null);
        log("No history files available, cleared");
      }
    } else {
      const latest = historyFiles[historyFiles.length - 1];
      if (currentHistoryFile !== latest) {
        setCurrentHistoryFile(latest);
        log(`Set currentHistoryFile to latest: ${latest}`);
      }
    }
  }, [historyFiles, currentHistoryFile]);

  const setLocalHistoryManual = useCallback((flights: Flight[]) => {
    setLocalHistory(flights);
    setLocalPage(1);
    log(`Manually set localHistory with ${flights.length} flights`);
  }, []);

  const localMaxPage = useMemo(() => Math.max(1, Math.ceil(localHistory.length / PER_PAGE)), [localHistory]);
  const localPageData = useMemo(() => localHistory.slice((localPage - 1) * PER_PAGE, localPage * PER_PAGE), [localHistory, localPage]);

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
