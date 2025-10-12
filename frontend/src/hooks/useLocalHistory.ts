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
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// Wrapper fetch avec cache-buster pour forcer rechargement dans Chrome
async function fetchHistoryWithCacheBuster(fetchHistory: (filename: string) => Promise<Flight[]>, filename: string): Promise<Flight[]> {
  const urlWithTimestamp = `${filename}?t=${Date.now()}`;
  // On suppose que fetchHistory accepte une URL relative ou on adapte fetchHistory en conséquence
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

  // Chargement du fichier historique à la sélection et mise à jour, ou à refreshCounter change
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

    if (prevHistoryFileRef.current === currentHistoryFile && refreshCounter === 0) {
      log(`Same currentHistoryFile ${currentHistoryFile}, no refresh, skip fetch`);
      return;
    }

    prevHistoryFileRef.current = currentHistoryFile;

    console.log(`[useLocalHistory] Début fetch historique fichier: ${currentHistoryFile}`);

    (async () => {
      try {
        setLoading(true);
        log(`Fetching history file: ${currentHistoryFile}`);
        // Utilisation du fetch avec cache-buster
        const flights = await fetchHistoryWithCacheBuster(fetchHistory, currentHistoryFile);
        console.log(`[useLocalHistory] Données reçues (${flights.length} vols) pour fichier ${currentHistoryFile}`);
        // Forcer nouvelle référence pour React re-render
        setLocalHistory([...flights]);
        setLocalPage(1);
        setError(null);
      } catch (e) {
        const msg = `Erreur chargement historique ${currentHistoryFile}: ${(e as Error).message}`;
        setError(msg);
        console.log(`[useLocalHistory] ${msg}`);
        onUserError?.(msg);
        setLocalHistory([]);
        setLocalPage(1);
        log(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentHistoryFile, fetchHistory, onUserError, refreshCounter, debug, log]);

  // Rafraîchissement forcé si backend notifie modification du fichier courant
  useEffect(() => {
    if (
      refreshTrigger &&
      refreshTrigger === currentHistoryFile &&
      prevRefreshTrigger !== refreshTrigger
    ) {
      console.log(`[useLocalHistory] Refresh déclenché pour fichier courant ${currentHistoryFile}`);
      setRefreshCounter((v) => v + 1);
    }
  }, [refreshTrigger, currentHistoryFile, prevRefreshTrigger]);

  // Mise à jour automatique du fichier courant vers le dernier fichier disponible
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
        log(`Set currentHistoryFile to latest: ${latest}`);
        setCurrentHistoryFile(latest);
      }
    }
  }, [historyFiles, currentHistoryFile, log]);

  // Trier localHistory par created_time décroissant (plus récent en premier)
  const sortedLocalHistory = useMemo(() => {
    return [...localHistory]
      .filter(flight => flight.state === 'local')  // Filtrage sur état 'local'
      .sort((a, b) => {
        const dateA = new Date(a.created_time ?? "").getTime();
        const dateB = new Date(b.created_time ?? "").getTime();
        return dateB - dateA; // décroissant (plus récent en premier)
      });
  }, [localHistory]);
  
  const localMaxPage = useMemo(() => Math.max(1, Math.ceil(sortedLocalHistory.length / PER_PAGE)), [sortedLocalHistory]);

  const localPageData = useMemo(() => sortedLocalHistory.slice((localPage - 1) * PER_PAGE, localPage * PER_PAGE), [sortedLocalHistory, localPage]);

  const setLocalHistoryManual = useCallback((flights: Flight[]) => {
    setLocalHistory([...flights]); // Forcer nouvelle référence
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
