"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type OrdersPollingFetcher<T> = (params: {
  role: string;
  userId: string;
  signal: AbortSignal;
}) => Promise<T>;

type UseOrdersPollingOptions<T> = {
  role: string;
  userId: string;
  intervalMs?: number;
  enabled?: boolean;
  fetcher: OrdersPollingFetcher<T>;
};

export function useOrdersPolling<T>({
  role,
  userId,
  intervalMs = 5000,
  enabled = true,
  fetcher,
}: UseOrdersPollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);

  const runFetch = useCallback(async () => {
    if (!enabled || isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const next = await fetcher({ role, userId, signal: controller.signal });
      if (!mountedRef.current) {
        return;
      }
      setData(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (fetchError) {
      if (controller.signal.aborted || !mountedRef.current) {
        return;
      }
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudo cargar la información.",
      );
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [enabled, fetcher, role, userId]);

  useEffect(() => {
    mountedRef.current = true;
    void runFetch();

    if (!enabled) {
      return () => {
        mountedRef.current = false;
        abortRef.current?.abort();
        isFetchingRef.current = false;
      };
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      void runFetch();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      abortRef.current?.abort();
      isFetchingRef.current = false;
    };
  }, [enabled, intervalMs, runFetch]);

  return { data, isLoading, error, lastUpdated, refresh: runFetch };
}
