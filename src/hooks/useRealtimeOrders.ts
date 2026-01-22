"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Loader<T> = () => Promise<T>;

export function useRealtimeOrders<T>(
  loader: Loader<T>,
  options: { intervalMs?: number; enabled?: boolean } = {},
) {
  const { intervalMs = 4000, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }

    try {
      setIsLoading(true);
      const next = await loader();
      if (mountedRef.current) {
        setData(next);
        setError(null);
      }
    } catch (loadError) {
      if (mountedRef.current) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudo cargar la información.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, loader]);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    const interval = window.setInterval(() => {
      void load();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [enabled, intervalMs, load]);

  return { data, isLoading, error, refresh: load };
}
