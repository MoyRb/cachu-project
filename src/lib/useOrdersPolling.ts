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
  signature?: (data: T) => string;
};

export function useOrdersPolling<T>({
  role,
  userId,
  intervalMs = 5000,
  enabled = true,
  fetcher,
  signature,
}: UseOrdersPollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  const signatureRef = useRef<string | null>(null);

  const runFetch = useCallback(async () => {
    if (!enabled || isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsRefreshing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const next = await fetcher({ role, userId, signal: controller.signal });
      if (!mountedRef.current) {
        return;
      }
      const nextSignature = signature ? signature(next) : JSON.stringify(next);
      if (signatureRef.current !== nextSignature) {
        signatureRef.current = nextSignature;
        setData(next);
        setLastChangedAt(new Date());
      }
      if (error !== null) {
        setError(null);
      }
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
        setIsRefreshing(false);
      }
      isFetchingRef.current = false;
    }
  }, [enabled, fetcher, role, signature, userId, error]);

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

  return {
    data,
    isRefreshing,
    error,
    lastChangedAt,
    refreshNow: runFetch,
  };
}
