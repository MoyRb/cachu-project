"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { KitchenRole } from "@/lib/kitchen/auth";
import { supabaseBrowser } from "@/lib/supabase/client";

type UseAwaitingPaymentCountOptions = {
  role: KitchenRole;
  userId: number;
  enabled?: boolean;
};

const resolveRequestError = (data: unknown, err: unknown) =>
  typeof (data as { error?: unknown })?.error === "string"
    ? (data as { error: string }).error
    : err instanceof Error
      ? err.message
      : String(err);

export function useAwaitingPaymentCount({
  role,
  userId,
  enabled = true,
}: UseAwaitingPaymentCountOptions) {
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  const fetchCount = useCallback(async () => {
    if (!enabled) {
      return;
    }

    try {
      const response = await kitchenFetch(
        "/api/orders?payment_status=AWAITING_PAYMENT",
        undefined,
        { role, userId },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          resolveRequestError(
            payload,
            new Error("No se pudo cargar el conteo pendiente de cobro."),
          ),
        );
      }

      const nextCount = Array.isArray(payload?.orders) ? payload.orders.length : 0;
      if (!mountedRef.current) {
        return;
      }
      setCount(nextCount);
      setError(null);
    } catch (fetchError) {
      if (!mountedRef.current) {
        return;
      }
      setError(resolveRequestError(null, fetchError));
    }
  }, [enabled, role, userId]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchCount();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchCount]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = supabaseBrowser.channel(`awaiting-payment-${role}-${userId}`);
    const refetch = () => {
      void fetchCount();
    };

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      refetch,
    );
    channel.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "orders" },
      refetch,
    );

    channel.subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [enabled, fetchCount, role, userId]);

  return {
    awaitingPaymentCount: count,
    awaitingPaymentError: error,
    refreshAwaitingPaymentCount: fetchCount,
  };
}
