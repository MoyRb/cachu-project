"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TopBar } from "@/components/ui/TopBar";
import { useKitchenRole } from "@/hooks/useKitchenRole";
import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { Order } from "@/lib/kitchen/types";
import { printRawBT } from "@/lib/printing/rawbt";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
];

type CashOrderType = "DINEIN" | "TAKEOUT";
type OrderSourceFilter = "ALL" | "POS" | "WHATSAPP";
type OrderTypeFilter = "ALL" | "DINEIN" | "TAKEOUT" | "DELIVERY";

const ORDER_TYPE_STORAGE_KEY = "order_type";
const AUDIO_ENABLED_STORAGE_KEY = "cachu-audio-enabled";

const typeLabels: Record<CashOrderType, string> = {
  DINEIN: "Comer aquí",
  TAKEOUT: "Para llevar",
};

const alertTypeLabels: Record<string, string> = {
  DINEIN: "Comer aquí",
  TAKEOUT: "Para llevar / Recoger",
  DELIVERY: "A domicilio",
};

type AlertOrder = {
  id: number;
  order_number: number;
  type: string;
  total_cents: number;
};

type TodayOrder = {
  id: number;
  order_number: number;
  created_at: string;
  source: "POS" | "WHATSAPP";
  type: "DINEIN" | "TAKEOUT" | "DELIVERY";
  status: string;
  payment_status: "AWAITING_PAYMENT" | "PAID" | "CANCELLED";
  total_cents: number;
};

type TodaySummary = {
  total_sales_cents: number;
  total_paid_cents: number;
  total_pending_cents: number;
  total_orders: number;
  paid_orders: number;
  pending_orders: number;
  by_source: {
    POS: {
      total_sales_cents: number;
      total_orders: number;
    };
    WHATSAPP: {
      total_sales_cents: number;
      total_orders: number;
    };
  };
};

const topBarLinkBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const topBarPrimaryLink = `${topBarLinkBase} h-12 px-6 text-lg bg-cta text-on-primary shadow-sm hover:bg-cta-hover`;

const formatCurrency = (valueCents: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(valueCents / 100);

const formatCurrencyMxn = (valueCents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valueCents / 100);

const resolveOrderTotal = (order: Order) => {
  if (typeof order.total_cents === "number") {
    return order.total_cents;
  }
  const subtotal = order.subtotal_cents ?? 0;
  const deliveryFee = order.delivery_fee_cents ?? 0;
  return subtotal + deliveryFee;
};

const playNewOrderTones = (ctx: AudioContext) => {
  // Secuencia de 3 tonos reconocibles: do-mi-do
  const tones = [880, 1100, 880];
  const toneDuration = 0.13;
  const gapBetween = 0.07;
  tones.forEach((freq, i) => {
    const t0 = ctx.currentTime + i * (toneDuration + gapBetween);
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.3, t0 + 0.01);
      gain.gain.linearRampToValueAtTime(0, t0 + toneDuration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + toneDuration);
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch { /* ignore */ }
      };
    } catch { /* ignore per-tone errors */ }
  });
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
  const [alertOrder, setAlertOrder] = useState<AlertOrder | null>(null);
  const [isPrintingAlert, setIsPrintingAlert] = useState(false);
  const [printAlertError, setPrintAlertError] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const alertTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioEnabledRef = useRef(false);
  const notifiedOrderIdsRef = useRef<Set<number>>(new Set());
  const [orderType, setOrderType] = useState<CashOrderType>("DINEIN");
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([]);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>("ALL");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedOrderType = window.localStorage.getItem(ORDER_TYPE_STORAGE_KEY);
    if (storedOrderType === "DINEIN" || storedOrderType === "TAKEOUT") {
      setOrderType(storedOrderType);
    }

    // Restaurar preferencia de audio (aún necesita interacción del usuario para desbloquear).
    const storedAudio = window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY);
    if (storedAudio === "true") {
      setAudioEnabled(true);
      audioEnabledRef.current = true;
    }
  }, []);

  const handleOrderTypeChange = (nextType: CashOrderType) => {
    setOrderType(nextType);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, nextType);
    }
  };

  const loadOrders = useCallback(async (markAsKnown = false) => {
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
      const fetchedOrders: Order[] = payload?.orders ?? [];
      setOrders(fetchedOrders);
      setError(null);
      if (markAsKnown) {
        // Marcar todos los pedidos existentes como conocidos al cargar la página,
        // para no disparar alertas por pedidos que ya estaban antes de abrir Caja.
        for (const order of fetchedOrders) {
          notifiedOrderIdsRef.current.add(order.id);
        }
      }
    } catch (loadError) {
      setError(resolveRequestError(null, loadError));
    } finally {
      setIsLoading(false);
    }
  }, [role, userId]);

  const loadTodayPanel = useCallback(async () => {
    try {
      setTodayLoading(true);
      const params = new URLSearchParams();
      if (sourceFilter !== "ALL") {
        params.set("source", sourceFilter);
      }
      if (typeFilter !== "ALL") {
        params.set("type", typeFilter);
      }
      const query = params.toString();
      const path = query ? `/api/orders/today?${query}` : "/api/orders/today";
      const response = await kitchenFetch(path, undefined, { role, userId });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          resolveRequestError(payload, new Error("No se pudo cargar el panel de hoy.")),
        );
      }
      setTodayOrders(payload?.orders ?? []);
      setTodaySummary(payload?.summary ?? null);
      setTodayError(null);
    } catch (panelError) {
      setTodayError(resolveRequestError(null, panelError));
    } finally {
      setTodayLoading(false);
    }
  }, [role, sourceFilter, typeFilter, userId]);

  useEffect(() => {
    void loadOrders(true);
  }, [loadOrders]);

  useEffect(() => {
    void loadTodayPanel();
  }, [loadTodayPanel]);

  const handleEnableAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      void audioContextRef.current.resume().then(() => {
        audioEnabledRef.current = true;
        setAudioEnabled(true);
        window.localStorage.setItem(AUDIO_ENABLED_STORAGE_KEY, "true");
        // Tono de confirmación
        if (audioContextRef.current) {
          playNewOrderTones(audioContextRef.current);
        }
      });
    } catch {
      /* ignore — alerta visual seguirá funcionando */
    }
  }, []);

  const notifyNewOrder = useCallback(
    (order: AlertOrder) => {
      // Deduplicación: un order_id genera como máximo una alerta por sesión.
      if (notifiedOrderIdsRef.current.has(order.id)) return;
      notifiedOrderIdsRef.current.add(order.id);

      setAlertOrder(order);
      setPrintAlertError(null);
      if (alertTimerRef.current) {
        window.clearTimeout(alertTimerRef.current);
      }
      alertTimerRef.current = window.setTimeout(() => {
        setAlertOrder(null);
      }, 30000);

      // Sonido — solo si el audio está desbloqueado por el usuario.
      if (audioContextRef.current && audioEnabledRef.current) {
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          void ctx.resume().then(() => playNewOrderTones(ctx));
        } else {
          playNewOrderTones(ctx);
        }
      }

      void loadOrders();
      void loadTodayPanel();
    },
    [loadOrders, loadTodayPanel],
  );

  const handleCloseAlert = useCallback(() => {
    setAlertOrder(null);
    if (alertTimerRef.current) {
      window.clearTimeout(alertTimerRef.current);
    }
  }, []);

  const handlePrintAlert = useCallback(
    async (orderId: number) => {
      setIsPrintingAlert(true);
      setPrintAlertError(null);
      try {
        const ticketRes = await kitchenFetch(
          `/api/orders/${orderId}/ticket`,
          undefined,
          { role, userId },
        );
        const ticketPayload = await ticketRes.json();
        if (!ticketRes.ok) {
          throw new Error(
            typeof ticketPayload?.error === "string"
              ? ticketPayload.error
              : "No se pudo obtener el ticket.",
          );
        }
        const ticketText = String(ticketPayload?.ticket_text ?? "").trim();
        if (!ticketText) {
          throw new Error("El ticket está vacío.");
        }
        await printRawBT(ticketText);
        await kitchenFetch(
          `/api/orders/${orderId}/printed`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "customer" }),
          },
          { role, userId },
        );
      } catch (err) {
        setPrintAlertError(
          err instanceof Error ? err.message : "No se pudo imprimir el ticket.",
        );
      } finally {
        setIsPrintingAlert(false);
      }
    },
    [role, userId],
  );

  // ── Realtime: canal principal de pedidos nuevos ──────────────────────────
  useEffect(() => {
    const channel = supabaseBrowser.channel("caja-orders");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      (payload) => {
        const paymentStatus = payload.new?.payment_status as string | undefined;
        if (paymentStatus && paymentStatus !== "AWAITING_PAYMENT") return;

        const orderId = payload.new?.id as number | undefined;
        const orderNumber = payload.new?.order_number as number | undefined;
        const orderType = payload.new?.type as string | undefined;
        const totalCents = payload.new?.total_cents as number | undefined;

        if (orderId && orderNumber && orderType) {
          notifyNewOrder({
            id: orderId,
            order_number: orderNumber,
            type: orderType,
            total_cents: totalCents ?? 0,
          });
        }
      },
    );

    channel.subscribe();

    return () => {
      if (alertTimerRef.current) {
        window.clearTimeout(alertTimerRef.current);
      }
      supabaseBrowser.removeChannel(channel);
    };
  }, [notifyNewOrder]);

  // ── Polling: fallback de 15 s si Realtime falla ──────────────────────────
  useEffect(() => {
    if (!role || !userId) return;

    const pollId = window.setInterval(async () => {
      try {
        const res = await kitchenFetch(
          "/api/orders?payment_status=AWAITING_PAYMENT",
          undefined,
          { role, userId },
        );
        if (!res.ok) return;
        const data = await res.json();
        const pollOrders: Order[] = data?.orders ?? [];
        for (const order of pollOrders) {
          if (!notifiedOrderIdsRef.current.has(order.id)) {
            const total = resolveOrderTotal(order);
            notifyNewOrder({
              id: order.id,
              order_number: order.order_number,
              type: order.type,
              total_cents: total,
            });
          }
        }
      } catch { /* ignore poll errors — Realtime es el canal principal */ }
    }, 15000);

    return () => window.clearInterval(pollId);
  }, [role, userId, notifyNewOrder]);

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
      await Promise.all([loadOrders(), loadTodayPanel()]);
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
            <p className="text-base font-semibold text-muted">
              {typeLabels[orderType]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/kiosco" className={topBarPrimaryLink}>
              Regresar
            </Link>
            <Link href="/cocina" className={topBarPrimaryLink}>
              Cocina
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 p-1">
              <Button
                size="md"
                type="button"
                variant={orderType === "DINEIN" ? "primary" : "secondary"}
                onClick={() => handleOrderTypeChange("DINEIN")}
              >
                Comer aquí
              </Button>
              <Button
                size="md"
                type="button"
                variant={orderType === "TAKEOUT" ? "primary" : "secondary"}
                onClick={() => handleOrderTypeChange("TAKEOUT")}
              >
                Para llevar
              </Button>
            </div>
            <Button size="lg" variant="secondary" onClick={() => void loadOrders()}>
              Actualizar
            </Button>
            <Button size="lg" variant="secondary" onClick={loadTodayPanel}>
              Refrescar hoy
            </Button>
            <Button
              size="lg"
              variant={audioEnabled ? "primary" : "secondary"}
              type="button"
              onClick={handleEnableAudio}
            >
              {audioEnabled ? "🔊 Alertas activadas" : "🔊 Activar alertas"}
            </Button>
          </div>
        </TopBar>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle>Pedidos de hoy</CardTitle>
              <CardDescription>
                Zona horaria America/Mexico_City · resumen financiero del día
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-muted">
                Source:
                <select
                  className="ml-2 h-10 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-ink"
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(event.target.value as OrderSourceFilter)
                  }
                >
                  <option value="ALL">All</option>
                  <option value="POS">POS</option>
                  <option value="WHATSAPP">WHATSAPP</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-muted">
                Tipo:
                <select
                  className="ml-2 h-10 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-ink"
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as OrderTypeFilter)
                  }
                >
                  <option value="ALL">All</option>
                  <option value="TAKEOUT">TAKEOUT</option>
                  <option value="DELIVERY">DELIVERY</option>
                  <option value="DINEIN">DINEIN</option>
                </select>
              </label>
            </div>
          </div>

          {todayError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {todayError}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-1">
              <CardDescription>Total ventas</CardDescription>
              <CardTitle>{formatCurrencyMxn(todaySummary?.total_sales_cents ?? 0)}</CardTitle>
              <p className="text-sm text-muted">
                {todaySummary?.total_orders ?? 0} pedidos
              </p>
            </Card>
            <Card className="gap-1">
              <CardDescription>Total pagado</CardDescription>
              <CardTitle>{formatCurrencyMxn(todaySummary?.total_paid_cents ?? 0)}</CardTitle>
              <p className="text-sm text-muted">
                {todaySummary?.paid_orders ?? 0} pagados
              </p>
            </Card>
            <Card className="gap-1">
              <CardDescription>Total pendiente</CardDescription>
              <CardTitle>{formatCurrencyMxn(todaySummary?.total_pending_cents ?? 0)}</CardTitle>
              <p className="text-sm text-muted">
                {todaySummary?.pending_orders ?? 0} pendientes
              </p>
            </Card>
            <Card className="gap-1">
              <CardDescription>POS vs WHATSAPP</CardDescription>
              <CardTitle className="text-lg">
                POS {todaySummary?.by_source?.POS.total_orders ?? 0} · WA{" "}
                {todaySummary?.by_source?.WHATSAPP.total_orders ?? 0}
              </CardTitle>
              <p className="text-sm text-muted">
                {formatCurrencyMxn(todaySummary?.by_source?.POS.total_sales_cents ?? 0)} /{" "}
                {formatCurrencyMxn(todaySummary?.by_source?.WHATSAPP.total_sales_cents ?? 0)}
              </p>
            </Card>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Orden</th>
                  <th className="px-3 py-2">Creado</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2 text-right">Total MXN</th>
                </tr>
              </thead>
              <tbody>
                {todayOrders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-3 py-2 font-semibold text-ink">#{order.order_number}</td>
                    <td className="px-3 py-2 text-muted">
                      {new Date(order.created_at).toLocaleString("es-MX", {
                        timeZone: "America/Mexico_City",
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-ink">{order.source}</td>
                    <td className="px-3 py-2 text-ink">{order.type}</td>
                    <td className="px-3 py-2 text-ink">{order.status}</td>
                    <td className="px-3 py-2 text-ink">{order.payment_status}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">
                      {formatCurrencyMxn(order.total_cents)}
                    </td>
                  </tr>
                ))}
                {!todayLoading && todayOrders.length === 0 && (
                  <tr>
                    <td className="px-3 py-5 text-center text-muted" colSpan={7}>
                      No hay pedidos para hoy con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {todayLoading && (
            <p className="text-sm font-semibold text-muted">Cargando panel de hoy...</p>
          )}
        </Card>

        {alertOrder && (
          <div className="rounded-2xl border-2 border-cta bg-cta/10 px-6 py-5 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-wide text-cta">
                  Nuevo pedido
                </p>
                <h2 className="text-2xl font-bold text-ink">
                  Pedido #{String(alertOrder.order_number).padStart(3, "0")}
                </h2>
                <p className="text-base font-semibold text-muted">
                  {alertTypeLabels[alertOrder.type] ?? alertOrder.type}
                  {" · "}
                  {formatCurrencyMxn(alertOrder.total_cents)}
                </p>
                {printAlertError && (
                  <p className="text-sm font-semibold text-rose-700">
                    {printAlertError}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  variant="secondary"
                  type="button"
                  onClick={() => void handlePrintAlert(alertOrder.id)}
                  disabled={isPrintingAlert}
                >
                  {isPrintingAlert ? "Imprimiendo..." : "Imprimir ticket"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  type="button"
                  onClick={handleCloseAlert}
                >
                  Cerrar
                </Button>
              </div>
            </div>
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
