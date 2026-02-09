"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TopBar } from "@/components/ui/TopBar";
import { useKitchenRole } from "@/hooks/useKitchenRole";
import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { Order } from "@/lib/kitchen/types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
];

const formatCurrency = (valueCents: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valueCents / 100);

const resolveOrderTotal = (order: Order) => {
  if (typeof order.total_cents === "number") {
    return order.total_cents;
  }
  const subtotal = order.subtotal_cents ?? 0;
  const deliveryFee = order.delivery_fee_cents ?? 0;
  return subtotal + deliveryFee;
};

const playNewOrderSound = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.4);
    oscillator.onended = () => {
      void audioContext.close();
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.log("[caja] audio error:", error);
    }
  }
};

const resolveRequestError = (data: unknown, err: unknown) =>
  typeof (data as { error?: unknown })?.error === "string"
    ? (data as { error: string }).error
    : err instanceof Error
      ? err.message
      : String(err);

export default function CajaPage() {
  const { role, userId } = useKitchenRole("ADMIN");
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPayingId, setIsPayingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [methodByOrder, setMethodByOrder] = useState<Record<number, string>>(
    {},
  );
  const [showAlert, setShowAlert] = useState(false);
  const alertTimerRef = useRef<number | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await kitchenFetch(
        "/api/orders?payment_status=AWAITING_PAYMENT",
        undefined,
        { role, userId },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          resolveRequestError(payload, new Error("No se pudieron cargar las órdenes.")),
        );
      }
      setOrders(payload?.orders ?? []);
      setError(null);
    } catch (loadError) {
      setError(resolveRequestError(null, loadError));
    } finally {
      setIsLoading(false);
    }
  }, [role, userId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const channel = supabaseBrowser.channel("caja-orders");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      (payload) => {
        const paymentStatus = payload.new?.payment_status;
        if (paymentStatus && paymentStatus !== "AWAITING_PAYMENT") {
          return;
        }
        setShowAlert(true);
        if (alertTimerRef.current) {
          window.clearTimeout(alertTimerRef.current);
        }
        alertTimerRef.current = window.setTimeout(() => {
          setShowAlert(false);
        }, 8000);
        playNewOrderSound();
        void loadOrders();
      },
    );

    channel.subscribe();

    return () => {
      if (alertTimerRef.current) {
        window.clearTimeout(alertTimerRef.current);
      }
      supabaseBrowser.removeChannel(channel);
    };
  }, [loadOrders]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    );
  }, [orders]);

  const handleMethodChange = (orderId: number, method: string) => {
    setMethodByOrder((current) => ({ ...current, [orderId]: method }));
  };

  const handleMarkPaid = async (order: Order) => {
    setActionError(null);
    setIsPayingId(order.id);
    try {
      const amount = resolveOrderTotal(order);
      const method = methodByOrder[order.id] ?? "cash";
      const response = await kitchenFetch(
        "/api/payments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: order.id,
            amount_cents: amount,
            method,
          }),
        },
        { role, userId },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          resolveRequestError(payload, new Error("No se pudo marcar como pagada.")),
        );
      }
      await loadOrders();
    } catch (payError) {
      setActionError(resolveRequestError(null, payError));
    } finally {
      setIsPayingId(null);
    }
  };

  const isEmpty = !isLoading && sortedOrders.length === 0;

  return (
    <main className="min-h-screen bg-transparent px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <TopBar className="gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Caja
            </p>
            <h1 className="text-3xl font-bold text-ink">
              Órdenes por cobrar
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" variant="secondary" onClick={loadOrders}>
              Actualizar
            </Button>
          </div>
        </TopBar>

        {showAlert && (
          <div className="rounded-2xl border border-cta/40 bg-cta/10 px-6 py-4 text-lg font-semibold text-ink">
            ¡Llegó una nueva orden! Revísala en caja.
          </div>
        )}

        {actionError && (
          <div className="rounded-2xl border border-cta/40 bg-cta/10 px-6 py-4 text-base text-ink">
            {actionError}
          </div>
        )}

        {isEmpty ? (
          <EmptyState
            title="Sin órdenes pendientes"
            subtitle={
              error ??
              "Las órdenes sin pago aparecerán aquí automáticamente."
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sortedOrders.map((order) => {
              const total = resolveOrderTotal(order);
              return (
                <Card
                  key={order.id}
                  className={cn(
                    "flex h-full flex-col gap-4",
                    isPayingId === order.id ? "opacity-70" : "",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>
                        Orden #{order.order_number}
                      </CardTitle>
                      <CardDescription>
                        {new Date(order.created_at).toLocaleTimeString(
                          "es-CL",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}{" "}
                        · {order.type}
                      </CardDescription>
                    </div>
                    <span className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink">
                      {formatCurrency(total)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-muted">
                    <p>
                      {order.items.length} ítems ·{" "}
                      {order.notes ? `Notas: ${order.notes}` : "Sin notas"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-semibold text-muted">
                      Método:
                    </label>
                    <select
                      className="h-11 rounded-full border border-border bg-surface px-4 text-sm font-semibold text-ink"
                      value={methodByOrder[order.id] ?? "cash"}
                      onChange={(event) =>
                        handleMethodChange(order.id, event.target.value)
                      }
                    >
                      {PAYMENT_METHODS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="lg"
                      onClick={() => handleMarkPaid(order)}
                      disabled={isPayingId === order.id}
                    >
                      Marcar pagado
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {isLoading && (
          <p className="text-sm font-semibold text-muted">
            Cargando órdenes pendientes...
          </p>
        )}
      </div>
    </main>
  );
}
