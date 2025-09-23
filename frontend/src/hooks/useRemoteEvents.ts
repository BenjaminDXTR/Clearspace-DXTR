import { useState, useEffect, useMemo } from "react";
import type { Event } from "../types/models";
import { PER_PAGE } from "../utils/constants";
import {
  EVENT_HISTORY_GRAPHQL,
  DRONETRACES_GRAPHQL,
  fetchGraphQL,
} from "../utils/graphql";
import { config } from "../config";

interface UseRemoteEventsOptions {
  /** Activer les logs debug (par défaut : en dev) */
  debug?: boolean;
}

export default function useRemoteEvents({
  debug = config.debug || config.environment === "development",
}: UseRemoteEventsOptions = {}) {
  const [remoteEvents, setRemoteEvents] = useState<Event[]>([]);
  const [traces, setTraces] = useState<Event[]>([]);
  const [apiPage, setApiPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dlog = (...args: any[]) => {
    if (debug) console.log(...args);
  };

  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;

    const fetchEventsAndTraces = async () => {
      abortController = new AbortController();
      setLoading(true);

      try {
        dlog("[useRemoteEvents] Récupération des événements...");
        const data = await fetchGraphQL(EVENT_HISTORY_GRAPHQL, config.apiUrl + "/graphql", {
          signal: abortController.signal,
        } as any);

        const events: Event[] = data.data?.events_by_paging?.data || [];

        if (!isMounted) return;
        setRemoteEvents(events);
        dlog(`[useRemoteEvents] ${events.length} événements récupérés`);

        if (events.length > 0) {
          const eventSeqs = events
            .map((e) => e.sequence)
            .filter((seq): seq is number => typeof seq === "number");

          if (eventSeqs.length > 0) {
            const minSeq = Math.min(...eventSeqs);
            const maxSeq = Math.max(...eventSeqs);
            const tracesQuery = DRONETRACES_GRAPHQL(minSeq, maxSeq);

            dlog(`[useRemoteEvents] Récupération des traces pour seq ${minSeq} → ${maxSeq}`);
            const tracesData = await fetchGraphQL(tracesQuery, config.apiUrl + "/graphql", {
              signal: abortController.signal,
            } as any);

            if (!isMounted) return;
            setTraces(tracesData.data?.dronetraces || []);
            dlog(`[useRemoteEvents] ${tracesData.data?.dronetraces?.length ?? 0} traces récupérées`);
          } else {
            setTraces([]);
            dlog("[useRemoteEvents] Aucun numéro de séquence pour récupérer des traces");
          }
        } else {
          setTraces([]);
          dlog("[useRemoteEvents] Aucun événement");
        }

        setError(null);
      } catch (err: unknown) {
        if (!isMounted) return;
        const message =
          err instanceof Error
            ? err.message
            : "Erreur inconnue lors de la récupération des événements";
        setError(message);
        setTraces([]);
        if (debug) console.error("[useRemoteEvents] Erreur:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEventsAndTraces();

    return () => {
      isMounted = false;
      if (abortController) abortController.abort();
    };
  }, [debug]);

  // Pagination calculée côté front
  const apiMaxPage = useMemo(
    () => Math.max(1, Math.ceil(remoteEvents.length / PER_PAGE)),
    [remoteEvents]
  );

  const apiPageData = useMemo(
    () =>
      remoteEvents.slice((apiPage - 1) * PER_PAGE, apiPage * PER_PAGE),
    [remoteEvents, apiPage]
  );

  return {
    remoteEvents,
    traces,
    apiPage,
    setApiPage,
    apiMaxPage,
    apiPageData,
    loading,
    error,
  };
}
