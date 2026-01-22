"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { useKitchenRole } from "@/hooks/useKitchenRole";
import { useRealtimeOrders } from "@/hooks/useRealtimeOrders";
import { formatElapsed, formatItemStatus } from "@/lib/kitchen/format";
import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { ItemStatus, Order } from "@/lib/kitchen/types";
import { cn } from "@/lib/utils";

const STATION = "FREIDORA" as const;

const ITEM_ACTIONS: Record<
  ItemStatus,
  { label: string; nextStatus: ItemStatus } | null
> = {
  EN_COLA: null,
  PENDIENTE: { label: "Iniciar preparación", nextStatus: "EN_PREPARACION" },
  EN_PREPARACION: { label: "Marcar listo", nextStatus: "LISTO" },
  LISTO: null,
};

export default function FreidoraPage() {
  const router = useRouter();
  const { role, userId, hasSession, isReady, clearSession } =
    useKitchenRole("FREIDORA");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionItemId, setActionItemId] = useState<number | null>(null);

  useEffect(() => {
    if (isReady && !hasSession) {
      router.replace("/cocina");
    }
  }, [hasSession, isReady, router]);

  const loader = async () => {
    const response = await kitchenFetch(
      "/api/orders",
      undefined,
      {
        role,
        userId,
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error ?? "No se pudieron cargar los pedidos.");
    }
    return payload?.orders ?? [];
  };

  const { data, isLoading, error, refresh } = useRealtimeOrders<Order[]>(
    loader,
    { intervalMs: 4000, enabled: true },
  );

  const orders = useMemo(() => {
    const list = (data ?? []).map((order) => ({
      ...order,
      items: order.items.filter((item) => item.station === STATION),
    }));

    return list
      .filter((order) => order.items.length > 0)
      .sort(
        (left, right) =>
          new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime(),
      );
  }, [data]);

  const handleStatusChange = async (
    itemId: number,
    nextStatus: ItemStatus,
  ) => {
    setActionError(null);
    setActionItemId(itemId);
    try {
      const response = await kitchenFetch(
        `/api/order-items/${itemId}`,
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
        throw new Error(payload?.error ?? "No se pudo actualizar el ítem.");
      }
      await refresh();
    } catch (updateError) {
      setActionError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el ítem.",
      );
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

  return (
    <main className="min-h-screen bg-cream px-6 py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <TopBar className="gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
              Cocina · Freidora
            </p>
            <h1 className="text-3xl font-bold text-ink">Pedidos en freidora</h1>
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

          {isLoading && orders.length === 0 ? (
            <Card>
              <CardTitle>Cargando pedidos...</CardTitle>
              <CardDescription className="mt-2 text-base">
                Actualizando lista de freidora.
              </CardDescription>
            </Card>
          ) : null}

          {orders.length === 0 && !isLoading ? (
            <Card>
              <CardTitle>Sin pedidos en freidora</CardTitle>
              <CardDescription className="mt-2 text-base">
                Todo listo por aquí. Los nuevos pedidos aparecerán
                automáticamente.
              </CardDescription>
            </Card>
          ) : null}

          {orders.map((order) => (
            <Card
              key={order.id}
              className={cn(
                "border-2",
                Date.now() - new Date(order.created_at).getTime() < 5 * 60000
                  ? "border-cta/80"
                  : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                    Pedido
                  </p>
                  <p className="text-4xl font-bold text-ink">
                    #{order.order_number}
                  </p>
                </div>
                <div className="text-right text-base font-semibold text-ink/70">
                  <p>{formatElapsed(order.created_at)}</p>
                  <p className="uppercase tracking-wide">{order.type}</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {order.items.map((item) => {
                  const action = ITEM_ACTIONS[item.status];
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-cream/80 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-2xl font-semibold text-ink">
                            {item.name_snapshot}
                          </p>
                          <p className="text-base font-semibold text-ink/60">
                            {formatItemStatus(item.status)} · x{item.qty}
                          </p>
                          {item.notes ? (
                            <p className="mt-2 text-base text-ink/70">
                              Nota: {item.notes}
                            </p>
                          ) : null}
                        </div>
                        {action ? (
                          <Button
                            size="xl"
                            onClick={() =>
                              handleStatusChange(item.id, action.nextStatus)
                            }
                            disabled={actionItemId === item.id}
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
        </section>

        <BottomActions className="gap-4">
          <div>
            <p className="text-base font-semibold text-ink">Modo freidora</p>
            <p className="text-sm text-ink/60">
              Actualización automática cada 4 segundos.
            </p>
          </div>
          <Button size="lg" variant="secondary" onClick={refresh}>
            Refrescar ahora
          </Button>
        </BottomActions>
      </div>
    </main>
  );
}
