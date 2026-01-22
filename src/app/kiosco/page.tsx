"use client";

import { useEffect, useMemo, useState } from "react";

import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal, ModalPanel } from "@/components/ui/Modal";
import { ProductCard } from "@/components/ui/ProductCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TopBar } from "@/components/ui/TopBar";

type OrderType = "DINEIN" | "TAKEOUT";
type Station = "PLANCHA" | "FREIDORA";

type Product = {
  id: number;
  name: string;
  description?: string | null;
  price_cents: number;
  station: Station;
  is_available: boolean;
  category?: { name?: string | null } | string | null;
};

type CartItem = {
  id: number;
  name: string;
  price_cents: number;
  station: Station;
  qty: number;
  notes: string;
};

const stationLabels: Record<Station, string> = {
  PLANCHA: "Plancha",
  FREIDORA: "Freidora",
};

const typeLabels: Record<OrderType, string> = {
  DINEIN: "Comer aquí",
  TAKEOUT: "Para llevar",
};

const formatCurrency = (valueCents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(valueCents / 100);

export default function KioscoPage() {
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderNumber: number;
    orderId: number;
    items: CartItem[];
    type: OrderType;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      try {
        setIsLoadingProducts(true);
        const response = await fetch("/api/products");
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error ?? "No se pudieron cargar productos.");
        }
        if (isMounted) {
          setProducts(payload?.data ?? []);
          setProductsError(null);
        }
      } catch (error) {
        if (isMounted) {
          setProductsError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar productos.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (orderConfirmation) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [orderConfirmation]);

  const availableProducts = useMemo(
    () => products.filter((product) => product.is_available),
    [products],
  );

  const groupedProducts = useMemo(() => {
    const hasCategory = availableProducts.some((product) => {
      if (typeof product.category === "string") {
        return product.category.trim().length > 0;
      }
      return Boolean(product.category?.name);
    });

    const groups = new Map<string, Product[]>();

    for (const product of availableProducts) {
      const categoryName =
        typeof product.category === "string"
          ? product.category
          : product.category?.name;
      const groupName = hasCategory
        ? categoryName?.trim() || "Otros"
        : stationLabels[product.station];

      const list = groups.get(groupName) ?? [];
      list.push(product);
      groups.set(groupName, list);
    }

    const entries = Array.from(groups.entries());

    if (!hasCategory) {
      const order = ["Plancha", "Freidora"];
      entries.sort(
        ([left], [right]) => order.indexOf(left) - order.indexOf(right),
      );
    }

    return entries.map(([label, items]) => ({ label, items }));
  }, [availableProducts]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.qty, 0),
    [cartItems],
  );

  const subtotalCents = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.qty * item.price_cents,
        0,
      ),
    [cartItems],
  );

  const handleAddItem = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price_cents: product.price_cents,
          station: product.station,
          qty: 1,
          notes: "",
        },
      ];
    });
  };

  const handleQtyChange = (id: number, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, qty: item.qty + delta } : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  const handleNoteChange = (id: number, value: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, notes: value } : item)),
    );
  };

  const handleResetOrder = () => {
    setOrderType(null);
    setCartItems([]);
    setOrderNotes("");
    setOrderConfirmation(null);
    setSubmitError(null);
    setIsConfirmOpen(false);
  };

  const handleSubmitOrder = async () => {
    if (!orderType || cartItems.length === 0) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: orderType,
          customer_name: null,
          customer_phone: null,
          notes: orderNotes.trim() || null,
          items: cartItems.map((item) => ({
            name_snapshot: item.name,
            price_cents_snapshot: item.price_cents,
            qty: item.qty,
            station: item.station,
            notes: item.notes.trim() || null,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudo crear el pedido.");
      }

      setOrderConfirmation({
        orderNumber: payload?.order?.order_number ?? 0,
        orderId: payload?.order?.id ?? 0,
        items: cartItems,
        type: orderType,
      });
      setCartItems([]);
      setOrderNotes("");
      setIsConfirmOpen(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No se pudo crear el pedido.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScrollToCart = () => {
    const target = document.getElementById("kiosco-cart");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!orderType && !orderConfirmation) {
    return (
      <div className="min-h-screen bg-cream px-6 py-10 text-ink sm:px-10">
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <TopBar>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                Kiosco local
              </p>
              <h1 className="text-4xl font-bold text-ink">Nuevo pedido</h1>
            </div>
            <StatusBadge status="nuevo" />
          </TopBar>

          <Card className="space-y-4">
            <CardTitle>Elige el tipo de pedido</CardTitle>
            <CardDescription>
              Selecciona cómo se entregará la orden. No se requiere número de
              mesa.
            </CardDescription>
          </Card>

          <BottomActions className="gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                Selección rápida
              </p>
              <p className="text-lg font-semibold">
                El cliente elige y continuamos al menú.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Button size="xl" onClick={() => setOrderType("DINEIN")}>
                Comer aquí
              </Button>
              <Button
                size="xl"
                variant="secondary"
                onClick={() => setOrderType("TAKEOUT")}
              >
                Para llevar
              </Button>
            </div>
          </BottomActions>
        </section>
      </div>
    );
  }

  if (orderConfirmation) {
    return (
      <div className="min-h-screen bg-cream px-6 py-10 text-ink sm:px-10">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <TopBar>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                Pedido confirmado
              </p>
              <h1 className="text-4xl font-bold text-ink">
                ¡Gracias por tu compra!
              </h1>
            </div>
            <StatusBadge status="listo" />
          </TopBar>

          <Card className="space-y-6 text-center">
            <div className="space-y-3">
              <p className="text-lg font-semibold text-ink/70">
                Número de pedido
              </p>
              <p className="text-6xl font-bold text-ink">
                #{String(orderConfirmation.orderNumber).padStart(3, "0")}
              </p>
              <p className="text-base text-ink/70">
                {typeLabels[orderConfirmation.type]}
              </p>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                Resumen
              </p>
              <ul className="mt-3 space-y-2 text-base font-semibold text-ink">
                {orderConfirmation.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <span>
                      {item.qty}× {item.name}
                    </span>
                    <span>{formatCurrency(item.price_cents * item.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <BottomActions>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                Pedido ID
              </p>
              <p className="text-lg font-semibold">
                #{orderConfirmation.orderId}
              </p>
            </div>
            <Button size="xl" onClick={handleResetOrder}>
              Nuevo pedido
            </Button>
          </BottomActions>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-6 py-10 text-ink sm:px-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <TopBar>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
              Kiosco local
            </p>
            <h1 className="text-3xl font-bold text-ink">Menú</h1>
            <p className="text-base font-semibold text-ink/70">
              {orderType ? typeLabels[orderType] : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              variant="secondary"
              onClick={handleResetOrder}
              type="button"
            >
              Cambiar tipo
            </Button>
            <StatusBadge status="nuevo" />
          </div>
        </TopBar>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
          <section className="space-y-8">
            <Card className="space-y-2">
              <CardTitle>Selecciona productos</CardTitle>
              <CardDescription>
                Productos disponibles por estación o categoría. Toca para
                agregar al carrito.
              </CardDescription>
            </Card>

            {isLoadingProducts ? (
              <Card>
                <p className="text-lg font-semibold text-ink">
                  Cargando productos...
                </p>
              </Card>
            ) : productsError ? (
              <Card>
                <p className="text-lg font-semibold text-ink">
                  {productsError}
                </p>
              </Card>
            ) : groupedProducts.length === 0 ? (
              <Card>
                <p className="text-lg font-semibold text-ink">
                  No hay productos disponibles.
                </p>
              </Card>
            ) : (
              groupedProducts.map((group) => (
                <div key={group.label} className="space-y-4">
                  <h2 className="text-2xl font-bold text-ink">
                    {group.label}
                  </h2>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {group.items.map((product) => (
                      <ProductCard
                        key={product.id}
                        title={product.name}
                        description={product.description ?? "Sin descripción"}
                        price={formatCurrency(product.price_cents)}
                        tag={stationLabels[product.station]}
                        onAction={() => handleAddItem(product)}
                        actionLabel="Agregar"
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <aside id="kiosco-cart" className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Carrito</CardTitle>
                <span className="text-sm font-semibold text-ink/70">
                  {cartCount} items
                </span>
              </div>

              {cartItems.length === 0 ? (
                <p className="text-base text-ink/70">
                  Agrega productos para comenzar el pedido.
                </p>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="space-y-2 rounded-2xl border border-border/60 bg-cream/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-lg font-semibold text-ink">
                            {item.name}
                          </p>
                          <p className="text-sm text-ink/70">
                            {stationLabels[item.station]} •{" "}
                            {formatCurrency(item.price_cents)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="md"
                            variant="secondary"
                            onClick={() => handleQtyChange(item.id, -1)}
                            type="button"
                          >
                            -
                          </Button>
                          <span className="text-lg font-semibold">
                            {item.qty}
                          </span>
                          <Button
                            size="md"
                            onClick={() => handleQtyChange(item.id, 1)}
                            type="button"
                          >
                            +
                          </Button>
                        </div>
                      </div>
                      <Input
                        placeholder="Notas para este item"
                        value={item.notes}
                        onChange={(event) =>
                          handleNoteChange(item.id, event.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Resumen</CardTitle>
                <span className="text-sm font-semibold text-ink/70">
                  {orderType ? typeLabels[orderType] : ""}
                </span>
              </div>
              <div className="space-y-2 text-base text-ink">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(subtotalCents)}</span>
                </div>
              </div>
              <Input
                placeholder="Notas generales del pedido"
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
              />
              <Button
                size="xl"
                onClick={() => setIsConfirmOpen(true)}
                disabled={cartItems.length === 0}
              >
                Confirmar pedido
              </Button>
            </Card>
          </aside>
        </div>
      </section>

      {cartItems.length > 0 ? (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-40 shadow-lg xl:hidden"
          onClick={handleScrollToCart}
        >
          Ver carrito ({cartCount})
        </Button>
      ) : null}

      {isConfirmOpen ? (
        <Modal>
          <ModalPanel className="max-w-2xl space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink/60">
                Confirmar pedido
              </p>
              <h2 className="text-2xl font-bold text-ink">
                {orderType ? typeLabels[orderType] : ""}
              </h2>
            </div>
            <div className="space-y-2 text-base text-ink">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between"
                >
                  <span>
                    {item.qty}× {item.name}
                  </span>
                  <span>{formatCurrency(item.price_cents * item.qty)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(subtotalCents)}</span>
              </div>
            </div>
            {submitError ? (
              <p className="rounded-2xl border border-wood/40 bg-cream px-4 py-3 text-sm font-semibold text-ink">
                {submitError}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={handleSubmitOrder}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Enviando..." : "Confirmar"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Revisar
              </Button>
            </div>
          </ModalPanel>
        </Modal>
      ) : null}
    </div>
  );
}
