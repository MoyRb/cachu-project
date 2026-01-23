"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TopBar } from "@/components/ui/TopBar";
import { useKitchenRole } from "@/hooks/useKitchenRole";
import {
  formatElapsed,
  formatItemStatus,
  formatOrderStatus,
  formatOrderType,
} from "@/lib/kitchen/format";
import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { Order, OrderStatus } from "@/lib/kitchen/types";
import { useOrdersPolling } from "@/lib/useOrdersPolling";
import { cn } from "@/lib/utils";

const STATUS_PRIORITY: Record<OrderStatus, number> = {
  LISTO_PARA_EMPACAR: 0,
  EMPACANDO: 1,
  LISTO_PARA_ENTREGAR: 2,
  EN_REPARTO: 3,
  RECIBIDO: 4,
  EN_PROCESO: 5,
  ENTREGADO: 6,
};
const formatLastUpdated = (date: Date) =>
  `Última actualización: ${date.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}`;

type OrderAction = { label: string; nextStatus: OrderStatus };

const getOrderActions = (order: Order): OrderAction[] => {
  switch (order.status) {
    case "LISTO_PARA_EMPACAR":
      return [{ label: "Iniciar empaquetado", nextStatus: "EMPACANDO" }];
    case "EMPACANDO":
      return [
        {
          label: "Listo para entregar",
          nextStatus: "LISTO_PARA_ENTREGAR",
        },
      ];
    case "LISTO_PARA_ENTREGAR":
      if (order.type === "DELIVERY") {
        return [{ label: "Enviar a reparto", nextStatus: "EN_REPARTO" }];
      }
      return [{ label: "Entregado", nextStatus: "ENTREGADO" }];
    case "EN_REPARTO":
      return [{ label: "Entregado", nextStatus: "ENTREGADO" }];
    default:
      return [];
  }
};

export default function EmpaquetadoPage() {
  const router = useRouter();
  const { role, userId, hasSession, isReady, clearSession } =
    useKitchenRole("EMPAQUETADO");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);

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
      throw new Error(payload?.error ?? "No se pudieron cargar los pedidos.");
    }
    return payload?.orders ?? [];
  };

  const { data, isLoading, error, refresh, lastUpdated } =
    useOrdersPolling<Order[]>({
      role,
      userId,
      intervalMs: 5000,
      enabled: true,
      fetcher: loader,
    });

  const orders = useMemo(() => {
    return (data ?? []).slice().sort((left, right) => {
      const priority =
        (STATUS_PRIORITY[left.status] ?? 99) -
        (STATUS_PRIORITY[right.status] ?? 99);
      if (priority !== 0) {
        return priority;
      }
      return (
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime()
      );
    });
  }, [data]);

  const handleStatusChange = async (orderId: number, status: OrderStatus) => {
    setActionError(null);
    setActionOrderId(orderId);
    try {
      const response = await kitchenFetch(
        `/api/orders/${orderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
        {
          role,
          userId,
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo actualizar el pedido.");
      }
      await refresh();
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el pedido.",
      );
    } finally {
      setActionOrderId(null);
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
  const emptyTitle = error
    ? "Sin conexión"
    : "Sin pedidos para empaquetar";
  const emptySubtitle = error
    ? error
    : "Cuando plancha y freidora terminen, aparecerán aquí.";

  return (
    <main className="min-h-screen bg-cream px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <TopBar className="gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
              Cocina · Empaquetado
            </p>
            <h1 className="text-3xl font-bold text-ink">
              Empaquetado y despacho
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="rounded-full border border-border bg-cream px-4 py-2 text-sm font-semibold text-ink">
              Rol: {role}
            </span>
            <Button size="lg" variant="secondary" onClick={handleChangeRole}>
              Cambiar rol
            </Button>
            <Button size="lg" variant="secondary" onClick={refresh}>
              Actualizar
            </Button>
          </div>
        </TopBar>

        <section className="space-y-6">
          {isEmpty ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <EmptyState
                title={emptyTitle}
                subtitle={emptySubtitle}
                hint="Actualiza cada 5s."
                lastUpdated={
                  lastUpdated
                    ? formatLastUpdated(lastUpdated)
                    : "Última actualización: --"
                }
                isRefreshing={isLoading}
                onRefresh={refresh}
                icon="📦"
              />
            </div>
          ) : (
            <>
              {error ? (
                <Card className="border-2 border-wood/40 bg-cream">
                  <CardTitle>Sin conexión</CardTitle>
                  <CardDescription className="mt-2 text-base">
                    {error}
                  </CardDescription>
                </Card>
              ) : null}
              {actionError ? (
                <Card className="border-2 border-wood/40 bg-cream">
                  <CardTitle>No se pudo actualizar</CardTitle>
                  <CardDescription className="mt-2 text-base">
                    {actionError}
                  </CardDescription>
                </Card>
              ) : null}

              {orders.map((order) => {
                const actions = getOrderActions(order);
                const highlight = order.status === "LISTO_PARA_EMPACAR";
                return (
                  <Card
                    key={order.id}
                    className={cn(
                      "border-2",
                      highlight ? "border-cta/80" : "border-border",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                          Pedido
                        </p>
                        <p className="text-4xl font-bold text-ink">
                          #{order.order_number}
                        </p>
                        <p className="mt-2 text-base font-semibold text-ink/60">
                          {formatOrderType(order.type)} ·{" "}
                          {formatOrderStatus(order.status)}
                        </p>
                      </div>
                      <div className="text-right text-base font-semibold text-ink/70">
                        <p>{formatElapsed(order.created_at)}</p>
                        <p>{order.items.length} productos</p>
                      </div>
                    </div>

                    <div className="mt-6 space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-cream/70 p-3 text-base font-semibold text-ink"
                        >
                          <div>
                            <p className="text-lg font-semibold text-ink">
                              {item.name_snapshot}
                            </p>
                            <p className="text-sm text-ink/60">
                              {formatItemStatus(item.status)} · {item.station} ·
                              x{item.qty}
                            </p>
                            {item.notes ? (
                              <p className="mt-1 text-sm text-ink/70">
                                Nota: {item.notes}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      {actions.map((action) => (
                        <Button
                          key={action.nextStatus}
                          size="xl"
                          onClick={() =>
                            handleStatusChange(order.id, action.nextStatus)
                          }
                          disabled={actionOrderId === order.id}
                        >
                          {action.label}
                        </Button>
                      ))}
                      <Button
                        size="lg"
                        variant="secondary"
                        onClick={() =>
                          window.open(`/print/order/${order.id}`, "_blank")
                        }
                      >
                        Imprimir ticket
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
