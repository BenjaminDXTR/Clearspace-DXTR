import { useState, useEffect } from "react";
import type { Flight } from "../types/models";
import { fetchLiveDrones } from "../services/api";
import { config } from "../config";

interface UseDronesOptions {
  /** Intervalle entre 2 requêtes (ms). Mettre <= 0 pour désactiver le polling */
  pollInterval?: number;
  /** Active les logs debug (par défaut : en dev) */
  debug?: boolean;
}

export default function useDrones({
  pollInterval = 2000,
  debug = config.debug || config.environment === "development",
}: UseDronesOptions = {}) {
  const [drones, setDrones] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchAndSet = async () => {
      if (!isMounted) return;
      abortController = new AbortController();
      try {
        dlog("[useDrones] Récupération des drones en cours...");
        const list = await fetchLiveDrones({ signal: abortController.signal });
        if (!isMounted) return;
        setDrones(list);
        setError(null);
        dlog(`[useDrones] ${list.length} drone(s) récupéré(s)`);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message =
          err instanceof Error
            ? err.message
            : "Erreur inconnue lors de la récupération des drones";
        setError(message);
        if (debug) console.error("[useDrones] Erreur récupération drones:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Première requête immédiate
    fetchAndSet();

    // Polling si activé
    let intervalId: ReturnType<typeof setInterval> | null = null;
    if (pollInterval > 0) {
      intervalId = setInterval(fetchAndSet, pollInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
      if (abortController) abortController.abort();
    };
  }, [pollInterval, debug]);

  return { drones, loading, error };
}
