"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { useKitchenRole } from "@/hooks/useKitchenRole";
import {
  formatElapsed,
  formatOrderStatus,
  formatOrderType,
} from "@/lib/kitchen/format";
import { kitchenFetch } from "@/lib/kitchen/fetch";
import type { Order } from "@/lib/kitchen/types";

const formatCurrency = (valueCents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(valueCents / 100);

export default function PrintOrderPage() {
  const params = useParams();
  const idParam = Array.isArray(params.id) ? params.id[0] : params.id;
  const orderId = Number(idParam);
  const { role, userId } = useKitchenRole("EMPAQUETADO");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!Number.isInteger(orderId)) {
        setError("Pedido inválido.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await kitchenFetch(
          `/api/orders/${orderId}`,
          undefined,
          {
            role,
            userId,
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "No se pudo cargar el pedido.");
        }
        if (isMounted) {
          setOrder(payload?.order ?? null);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el pedido.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [orderId, role, userId]);

  const subtotal = useMemo(() => {
    if (!order?.items) {
      return 0;
    }
    return order.items.reduce(
      (sum, item) => sum + (item.price_cents_snapshot ?? 0) * (item.qty ?? 1),
      0,
    );
  }, [order]);

  return (
    <main className="min-h-screen bg-white px-6 py-8 text-neutral-900">
      <style>{`
        @media print {
          button { display: none; }
          body { background: white; }
        }
      `}</style>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Ticket de pedido
            </p>
            <h1 className="text-3xl font-bold text-neutral-900">
              Pedido #{order?.order_number ?? ""}
            </h1>
          </div>
          <Button size="lg" variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
        </header>

        {isLoading ? (
          <Card className="border-neutral-200 bg-white text-neutral-900">
            <CardTitle className="text-neutral-900">Cargando pedido...</CardTitle>
            <CardDescription className="mt-2 text-neutral-600">
              Preparando ticket.
            </CardDescription>
          </Card>
        ) : null}

        {error ? (
          <Card className="border-neutral-200 bg-white text-neutral-900">
            <CardTitle className="text-neutral-900">
              No se pudo cargar el ticket
            </CardTitle>
            <CardDescription className="mt-2 text-neutral-600">
              {error}
            </CardDescription>
          </Card>
        ) : null}

        {order ? (
          <Card className="border-2 border-neutral-200 bg-white text-neutral-900">
            <div className="space-y-3 text-base">
              <p>
                <span className="font-semibold">Tipo:</span> {formatOrderType(order.type)}
              </p>
              <p>
                <span className="font-semibold">Estado:</span> {formatOrderStatus(order.status)}
              </p>
              <p>
                <span className="font-semibold">Creado:</span> {formatElapsed(order.created_at)}
              </p>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-4">
              <p className="text-lg font-semibold">Items</p>
              <ul className="mt-3 space-y-2">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{item.name_snapshot}</p>
                      <p className="text-sm text-neutral-600">
                        {item.station} · x{item.qty}
                      </p>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency((item.price_cents_snapshot ?? 0) * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 border-t border-neutral-200 pt-4 text-base">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {order.delivery_fee_cents ? (
                <div className="mt-2 flex items-center justify-between">
                  <span>Envío</span>
                  <span className="font-semibold">
                    {formatCurrency(order.delivery_fee_cents)}
                  </span>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>
                  {formatCurrency(
                    order.total_cents ?? subtotal + (order.delivery_fee_cents ?? 0),
                  )}
                </span>
              </div>
            </div>

            {order.notes ? (
              <div className="mt-6 border-t border-neutral-200 pt-4">
                <p className="text-base font-semibold">Notas</p>
                <p className="mt-2 text-sm text-neutral-600">{order.notes}</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </main>
  );
}
