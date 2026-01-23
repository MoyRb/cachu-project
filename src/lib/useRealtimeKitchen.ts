"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

type OrdersFetcher<T> = (params: {
  role: string;
  userId: string;
  signal: AbortSignal;
}) => Promise<T>;

type RealtimeStatus = "connecting" | "connected" | "fallback";

type UseRealtimeKitchenOptions<T> = {
  role: string;
  userId: string;
  enabled?: boolean;
  fetcher: OrdersFetcher<T>;
  signature?: (data: T) => string;
  station?: "PLANCHA" | "FREIDORA";
  fallbackIntervalMs?: number;
};

export function useRealtimeKitchen<T>({
  role,
  userId,
  enabled = true,
  fetcher,
  signature,
  station,
  fallbackIntervalMs = 60000,
}: UseRealtimeKitchenOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("connecting");
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const signatureRef = useRef<string | null>(null);
  const pollerRef = useRef<number | null>(null);

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
  }, [enabled, error, fetcher, role, signature, userId]);

  useEffect(() => {
    mountedRef.current = true;
    void runFetch();

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      isFetchingRef.current = false;
    };
  }, [runFetch]);

  useEffect(() => {
    if (!enabled) {
      setRealtimeStatus("fallback");
      return;
    }

    setRealtimeStatus("connecting");
    const channel = supabaseBrowser.channel(
      `kitchen-${station ?? "empaquetado"}-${role}-${userId}`,
    );
    let fallbackTimer: number | null = null;

    const refreshFromRealtime = () => {
      void runFetch();
    };

    const handleOrdersChange = (payload: {
      eventType: string;
      new?: { status?: string };
      old?: { status?: string };
    }) => {
      if (payload.eventType === "UPDATE") {
        const nextStatus = payload.new?.status;
        const prevStatus = payload.old?.status;
        if (nextStatus === prevStatus) {
          return;
        }
      }
      refreshFromRealtime();
    };

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      handleOrdersChange,
    );
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders" },
      handleOrdersChange,
    );
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "order_items",
        filter: station ? `station=eq.${station}` : undefined,
      },
      refreshFromRealtime,
    );
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "order_items",
        filter: station ? `station=eq.${station}` : undefined,
      },
      refreshFromRealtime,
    );

    channel.subscribe((status) => {
      if (!mountedRef.current) {
        return;
      }
      if (status === "SUBSCRIBED") {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
        }
        setRealtimeStatus("connected");
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setRealtimeStatus("fallback");
      }
      if (status === "CLOSED") {
        setRealtimeStatus((current) =>
          current === "connected" ? "fallback" : current,
        );
      }
    });

    fallbackTimer = window.setTimeout(() => {
      if (mountedRef.current) {
        setRealtimeStatus((current) =>
          current === "connected" ? current : "fallback",
        );
      }
    }, 8000);

    return () => {
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
      }
      supabaseBrowser.removeChannel(channel);
    };
  }, [enabled, role, runFetch, station, userId]);

  useEffect(() => {
    if (!enabled || realtimeStatus !== "fallback") {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }

    void runFetch();
    pollerRef.current = window.setInterval(() => {
      void runFetch();
    }, fallbackIntervalMs);

    return () => {
      if (pollerRef.current) {
        window.clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };
  }, [enabled, fallbackIntervalMs, realtimeStatus, runFetch]);

  return {
    data,
    isRefreshing,
    error,
    lastChangedAt,
    refreshNow: runFetch,
    realtimeStatus,
  };
}
