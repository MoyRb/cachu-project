"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TopBar } from "@/components/ui/TopBar";
import { useKitchenRole } from "@/hooks/useKitchenRole";
import { formatElapsed, formatItemStatus } from "@/lib/kitchen/format";
import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { ItemStatus, Order } from "@/lib/kitchen/types";
import { useRealtimeKitchen } from "@/lib/useRealtimeKitchen";
import { cn } from "@/lib/utils";

const STATION = "FREIDORA" as const;
const formatLastUpdated = (date: Date) =>
  `Última actualización: ${date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;
const getVisibleOrders = (orders: Order[]) => {
  return orders
    .filter((order) => order.status !== "ENTREGADO")
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => item.station === STATION),
    }))
    .filter((order) => order.items.length > 0)
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    );
};
const compareItemIds = (
  left: { id: Order["items"][number]["id"]; order_item_id?: Order["items"][number]["order_item_id"] },
  right: { id: Order["items"][number]["id"]; order_item_id?: Order["items"][number]["order_item_id"] },
) =>
  String(left.order_item_id ?? left.id).localeCompare(
    String(right.order_item_id ?? right.id),
    "es",
    { numeric: true },
  );
const resolveRequestError = (data: unknown, err: unknown) =>
  typeof (data as { error?: unknown })?.error === "string"
    ? (data as { error: string }).error
    : err instanceof Error
      ? err.message
      : String(err);
const getOrdersSignature = (orders: Order[]) =>
  JSON.stringify(
    getVisibleOrders(orders).map((order) => ({
      id: order.id,
      status: order.status,
      updated_at: order.updated_at,
      items: order.items
        .map((item) => ({
          id: item.order_item_id ?? item.id,
          status: item.status,
          updated_at: item.updated_at,
        }))
        .sort(compareItemIds),
    })),
  );

const ITEM_ACTIONS: Record<
  ItemStatus,
  { label: string; nextStatus: ItemStatus } | null
> = {
  EN_COLA: { label: "Iniciar preparación", nextStatus: "EN_PREPARACION" },
  PENDIENTE: { label: "Iniciar preparación", nextStatus: "EN_PREPARACION" },
  EN_PREPARACION: { label: "Marcar listo", nextStatus: "LISTO" },
  LISTO: null,
};

export default function FreidoraPage() {
  const router = useRouter();
  const { role, userId, hasSession, isReady, clearSession } =
    useKitchenRole("FREIDORA");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<string | number | null>(
    null,
  );

  useEffect(() => {
    if (isReady && !hasSession) {
      router.replace("/cocina");
    }
  }, [hasSession, isReady, router]);

  const loader = async ({
    role: currentRole,
    userId: currentUserId,
    signal,
  }: {
    role: string;
    userId: string;
    signal: AbortSignal;
  }) => {
    const response = await kitchenFetch(
      "/api/orders",
      { signal },
      {
        role: currentRole,
        userId: currentUserId,
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        resolveRequestError(payload, new Error("No se pudieron cargar los pedidos.")),
      );
    }
    return payload?.orders ?? [];
  };

  const {
    data,
    isRefreshing,
    error,
    refreshNow,
    lastChangedAt,
    realtimeStatus,
  } = useRealtimeKitchen<Order[]>({
    role,
    userId,
    enabled: true,
    fetcher: loader,
    signature: getOrdersSignature,
    station: STATION,
  });

  const orders = useMemo(() => {
    return getVisibleOrders(data ?? []);
  }, [data]);

  const handleStatusChange = async (
    orderItemId: string | number,
    nextStatus: ItemStatus,
  ) => {
    setActionError(null);
    setActionItemId(orderItemId);
    try {
      if (process.env.NODE_ENV === "development") {
        console.log("[cocina-freidora] PATCH order item:", {
          order_item_id: orderItemId,
        });
      }
      const response = await kitchenFetch(
        `/api/order-items/${orderItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
        {
          role,
          userId,
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          resolveRequestError(payload, new Error("No se pudo actualizar el ítem.")),
        );
      }
      await refreshNow();
    } catch (updateError) {
      setActionError(resolveRequestError(null, updateError));
    } finally {
      setActionItemId(null);
    }
  };

  const handleChangeRole = () => {
    clearSession();
    router.push("/cocina");
  };

  if (isReady && !hasSession) {
    return null;
  }

  const isEmpty = orders.length === 0;
  const emptyTitle = error ? "Sin conexión" : "Sin pedidos en freidora";
  const emptySubtitle = error
    ? error
    : "Todo listo por aquí. Los nuevos pedidos aparecerán automáticamente.";

  return (
    <main className="min-h-screen bg-transparent px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <TopBar className="gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Cocina · Freidora
            </p>
            <h1 className="text-3xl font-bold text-ink">Pedidos en freidora</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded-full border border-border bg-surface-2 px-4 py-2 text-sm font-semibold text-ink">
              Rol: {role}
            </span>
            <Button size="lg" variant="secondary" onClick={handleChangeRole}>
              Cambiar rol
            </Button>
            <Button size="lg" variant="secondary" onClick={refreshNow}>
              Actualizar
            </Button>
            <div className="flex min-w-[200px] items-center justify-end gap-2 text-xs font-semibold text-muted">
              <span
                className={cn(
                  "transition-opacity",
                  isRefreshing ? "opacity-100" : "opacity-0",
                )}
                aria-live="polite"
              >
                Sincronizando...
              </span>
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted">
                {realtimeStatus === "connected" ? "En vivo" : "Sin conexión"}
              </span>
            </div>
          </div>
        </TopBar>

        <section className="space-y-6">
          {isEmpty ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <EmptyState
                title={emptyTitle}
                subtitle={emptySubtitle}
                hint="Actualiza en vivo con Supabase Realtime."
                lastUpdated={
                  lastChangedAt
                    ? formatLastUpdated(lastChangedAt)
                    : "Última actualización: --"
                }
                onRefresh={refreshNow}
                icon="🍟"
              />
            </div>
          ) : (
            <>
              {error ? (
                <Card className="border-2 border-border bg-surface-2">
                  <CardTitle>Sin conexión</CardTitle>
                  <CardDescription className="mt-2 text-base">
                    {error}
                  </CardDescription>
                </Card>
              ) : null}
              {actionError ? (
                <Card className="border-2 border-border bg-surface-2">
                  <CardTitle>No se pudo actualizar</CardTitle>
                  <CardDescription className="mt-2 text-base">
                    {actionError}
                  </CardDescription>
                </Card>
              ) : null}

              {orders.map((order) => (
                <Card
                  key={order.id}
                  className={cn(
                    "border-2",
                    Date.now() - new Date(order.created_at).getTime() <
                      5 * 60000
                      ? "border-cta/80"
                      : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                        Pedido
                      </p>
                      <p className="text-4xl font-bold text-ink">
                        #{order.order_number}
                      </p>
                    </div>
                    <div className="text-right text-base font-semibold text-muted">
                      <p>{formatElapsed(order.created_at)}</p>
                      <p className="uppercase tracking-wide">{order.type}</p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {order.items.map((item) => {
                      const action = ITEM_ACTIONS[item.status];
                      const orderItemId = item.order_item_id ?? item.id;
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-border bg-surface-2 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-2xl font-semibold text-ink">
                                {item.name_snapshot}
                              </p>
                              <p className="text-base font-semibold text-muted">
                                {formatItemStatus(item.status)} · x{item.qty}
                              </p>
                              {item.notes ? (
                                <p className="mt-2 text-base text-muted">
                                  Nota: {item.notes}
                                </p>
                              ) : null}
                            </div>
                            {action ? (
                              <Button
                                size="xl"
                                onClick={() =>
                                  handleStatusChange(
                                    orderItemId,
                                    action.nextStatus,
                                  )
                                }
                                disabled={actionItemId === orderItemId}
                              >
                                {action.label}
                              </Button>
                            ) : (
                              <span className="rounded-full bg-success px-4 py-2 text-base font-semibold text-ink">
                                {item.status === "LISTO" ? "Listo" : "En cola"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
