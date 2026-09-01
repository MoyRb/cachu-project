"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { supabaseBrowser } from "@/lib/supabase/client";

type CustomerData = {
  user: {
    id: string;
    username: string;
    name: string;
  };
  points: number;
};

type HistoryOrderItem = {
  product_id: number | null;
  name: string;
  price_cents: number;
  qty: number;
  notes: string | null;
  station: string;
};

type HistoryOrder = {
  id: string;
  order_number: number;
  order_date: string | null;
  type: string;
  items_json: HistoryOrderItem[];
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  payment_method: string | null;
  points_earned: number;
  paid_at: string | null;
  created_at: string;
};

const historyTypeLabels: Record<string, string> = {
  TAKEOUT: "Recoger en Cachu",
  DELIVERY: "A domicilio",
  DINEIN: "Comer aquí",
};

const formatCurrency = (valueCents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(valueCents / 100);

export default function ClientePage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOrders, setHistoryOrders] = useState<HistoryOrder[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();

      if (!session) {
        router.replace("/cliente/login");
        return;
      }

      try {
        const [meResponse, historyResponse] = await Promise.all([
          fetch("/api/customer/me", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch("/api/customer/history", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        const meData = await meResponse.json();

        if (!meResponse.ok) {
          throw new Error(
            typeof meData?.error === "string" ? meData.error : "Error al cargar la cuenta."
          );
        }

        if (active) {
          setCustomer(meData as CustomerData);
          setError(null);
        }

        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          if (active) {
            setHistoryOrders((historyData?.orders ?? []) as HistoryOrder[]);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Error al cargar la cuenta.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
          setIsLoadingHistory(false);
        }
      }
    };

    void init();

    // Escuchar cambios de sesión: si se cierra, redirigir al login.
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.replace("/cliente/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const handleLogout = async () => {
    await supabaseBrowser.auth.signOut();
    router.replace("/cliente/login");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-base font-semibold text-muted">Cargando tu cuenta...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <p className="text-base font-semibold text-red-700">{error}</p>
        <Button variant="secondary" onClick={() => router.replace("/cliente/login")}>
          Volver al inicio de sesión
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-6 py-8">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        <TopBar>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Mi cuenta
            </p>
            <h1 className="text-3xl font-bold text-ink">
              Hola, {customer?.user.username}
            </h1>
          </div>
          <Button variant="secondary" size="md" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </TopBar>

        {/* Puntos */}
        <Card className="space-y-2 text-center">
          <CardDescription>Tus puntos</CardDescription>
          <CardTitle className="text-5xl">{customer?.points ?? 0}</CardTitle>
          <p className="text-sm text-muted">
            Por cada $100 de compra acumulas 1 punto.
          </p>
        </Card>

        {/* Acciones */}
        <Link
          href="/kiosco"
          className="inline-flex w-full items-center justify-center rounded-full bg-cta px-6 py-4 text-lg font-semibold text-on-primary shadow-sm hover:bg-cta-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/60"
        >
          Hacer pedido
        </Link>

        {/* Historial de pedidos */}
        <Card className="space-y-4">
          <CardTitle>Mis pedidos</CardTitle>
          {isLoadingHistory ? (
            <p className="text-sm text-muted">Cargando historial...</p>
          ) : historyOrders.length === 0 ? (
            <p className="text-sm text-muted">
              Todavía no tienes pedidos guardados.
            </p>
          ) : (
            <div className="space-y-4">
              {historyOrders.map((order) => {
                const items = Array.isArray(order.items_json) ? order.items_json : [];
                const dateLabel = order.order_date
                  ? new Date(order.order_date + "T12:00:00").toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : order.paid_at
                  ? new Date(order.paid_at).toLocaleDateString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "";
                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-border bg-surface-2/70 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-ink">
                          Pedido #{String(order.order_number).padStart(3, "0")}
                        </p>
                        <p className="text-sm text-muted">
                          {dateLabel}
                          {dateLabel ? " · " : ""}
                          {historyTypeLabels[order.type] ?? order.type}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-semibold text-ink">
                          {formatCurrency(order.total_cents)}
                        </p>
                        {order.points_earned > 0 && (
                          <p className="text-sm font-semibold text-cta">
                            +{order.points_earned} pts
                          </p>
                        )}
                      </div>
                    </div>
                    <ul className="space-y-0.5">
                      {items.map((item, idx) => (
                        <li key={idx} className="text-sm text-muted">
                          {item.qty}× {item.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
