"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BottomActions } from "@/components/ui/BottomActions";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ItemCustomizerModal } from "@/components/ui/ItemCustomizerModal";
import { Modal, ModalPanel } from "@/components/ui/Modal";
import { ProductCard } from "@/components/ui/ProductCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TopBar } from "@/components/ui/TopBar";
import { printRawBT } from "@/lib/printing/rawbt";

type OrderType = "DINEIN" | "TAKEOUT";
type Station = "PLANCHA" | "FREIDORA";

type Product = {
  id: number;
  name: string;
  description?: string | null;
  price_cents: number;
  station: Station;
  is_available: boolean;
  image_url?: string | null;
  category?: { name?: string | null } | string | null;
};

type CartItem = {
  lineId: string;
  productId: number;
  name: string;
  price_cents: number;
  station: Station;
  qty: number;
  notes: string;
  noIngredients: string[];
  isAlitas: boolean;
  isIngredientCustomized: boolean;
};

type IngredientCustomizationRule = {
  requiredCount: number;
};

const ALITAS_FLAVORS = [
  "Mango Habanero",
  "BBQ",
  "BBQ HOT",
  "Tamarindo HOT",
  "Lemon Pepper",
] as const;

const buildFlavorNote = (flavor: string) => `Sabor: ${flavor}`;

const INGREDIENT_OPTIONS = [
  "Milanesa",
  "Panela",
  "Jamón",
  "Tocino",
  "Pierna",
  "Chorizo",
  "Salchicha",
] as const;

const WITHOUT_INGREDIENT_OPTIONS = [
  "Lechuga",
  "Jitomate",
  "Zanahoria",
  "Cebolla",
  "Piña",
  "Jalapeños",
  "Catsup",
  "Mostaza",
  "BBQ",
  "Tocino",
  "Salchicha",
  "Jamón",
  "Panela",
  "Queso amarillo",
] as const;

const formatNotesFromWithout = (list: string[]): string => {
  if (list.length === 0) {
    return "";
  }

  const formatted = list.map((item) => item.toLowerCase());
  return `SIN: ${formatted.join(", ")}`;
};

const formatItemNotes = (item: CartItem): string => {
  const withoutNotes = formatNotesFromWithout(item.noIngredients);
  const currentNotes = item.notes.trim();

  if (!withoutNotes) {
    return currentNotes;
  }

  return currentNotes ? `${currentNotes} | ${withoutNotes}` : withoutNotes;
};

const PRODUCT_CUSTOMIZATION_RULES: Record<string, IngredientCustomizationRule> = {
  "Torta Sencilla": { requiredCount: 1 },
  "Torta Combinada": { requiredCount: 2 },
  "Torta con 3 ingredientes": { requiredCount: 3 },
};

const getIngredientCustomizationRule = (
  productName: string,
): IngredientCustomizationRule | null => PRODUCT_CUSTOMIZATION_RULES[productName] ?? null;

const buildIngredientNote = (ingredients: string[], note: string) => {
  const base = `Ingredientes: ${ingredients.join(", ")}`;
  const trimmedNote = note.trim();
  return trimmedNote ? `${base} | Nota: ${trimmedNote}` : base;
};

const parseIngredientNote = (notes: string) => {
  const trimmed = notes.trim();
  const [ingredientsPart, notePart] = trimmed.split("| Nota:");

  const ingredients = ingredientsPart
    ?.replace(/^Ingredientes:\s*/u, "")
    .split(",")
    .map((ingredient) => ingredient.trim())
    .filter((ingredient) => ingredient.length > 0) ?? [];

  return {
    ingredients,
    note: notePart?.trim() ?? "",
  };
};

const isAlitasProduct = (product: Product) => {
  const categoryName =
    typeof product.category === "string"
      ? product.category
      : product.category?.name ?? "";

  const normalizedCategory = categoryName.trim().toLowerCase();
  const normalizedName = product.name.trim().toLowerCase();

  if (normalizedCategory === "alitas") {
    return true;
  }

  return (
    normalizedName.startsWith("alitas") ||
    normalizedName.includes("alitas") ||
    normalizedName.includes("boneless")
  );
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

const createLineId = () =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const topBarLinkBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const topBarPrimaryLink = `${topBarLinkBase} h-12 px-6 text-lg bg-cta text-on-primary shadow-sm hover:bg-cta-hover`;
const topBarSecondaryLink = `${topBarLinkBase} h-10 px-4 text-sm border border-cta/70 text-ink hover:bg-cta/15`;
const appMode = process.env.NEXT_PUBLIC_APP_MODE ?? "customer";
const isStaffMode = appMode === "staff";

export default function KioscoPage() {
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [withoutModalState, setWithoutModalState] = useState<{
    lineId: string;
    selectedWithout: string[];
  } | null>(null);
  const [alitasSelectorState, setAlitasSelectorState] = useState<{
    mode: "add" | "edit";
    product: Product | null;
    productName: string | null;
    lineId: string | null;
  }>({ mode: "add", product: null, productName: null, lineId: null });
  const [itemCustomizerState, setItemCustomizerState] = useState<{
    mode: "add" | "edit";
    product: Product | null;
    productName: string | null;
    lineId: string | null;
    requiredCount: number;
    selectedIngredients: string[];
    note: string;
  }>({
    mode: "add",
    product: null,
    productName: null,
    lineId: null,
    requiredCount: 0,
    selectedIngredients: [],
    note: "",
  });
  const [orderConfirmation, setOrderConfirmation] = useState<{
    orderNumber: number;
    orderId: string;
    items: CartItem[];
    type: OrderType;
    ticketText: string;
  } | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const loadProducts = useCallback(async (showLoading: boolean) => {
    try {
      if (showLoading) {
        setIsLoadingProducts(true);
      }

      const response = await fetch("/api/products", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "No se pudieron cargar productos.");
      }

      setProducts(payload?.data ?? []);
      setProductsError(null);
    } catch (error) {
      setProductsError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar productos.",
      );
    } finally {
      if (showLoading) {
        setIsLoadingProducts(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProducts(true);

    const refreshInterval = window.setInterval(() => {
      void loadProducts(false);
    }, 30_000);

    return () => {
      window.clearInterval(refreshInterval);
    };
  }, [loadProducts]);

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

  const handleAddAlitasWithFlavor = (product: Product, flavor: string) => {
    const notes = buildFlavorNote(flavor);

    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.notes.trim() === notes,
      );

      if (existing) {
        return prev.map((item) =>
          item.lineId === existing.lineId ? { ...item, qty: item.qty + 1 } : item,
        );
      }

      return [
        ...prev,
        {
          lineId: createLineId(),
          productId: product.id,
          name: product.name,
          price_cents: product.price_cents,
          station: product.station,
          qty: 1,
          notes,
          noIngredients: [],
          isAlitas: true,
          isIngredientCustomized: false,
        },
      ];
    });
  };

  const openItemCustomizerForAdd = (product: Product, requiredCount: number) => {
    setItemCustomizerState({
      mode: "add",
      product,
      productName: product.name,
      lineId: null,
      requiredCount,
      selectedIngredients: [],
      note: "",
    });
  };

  const openItemCustomizerForEdit = (item: CartItem) => {
    const product = products.find((productItem) => productItem.id === item.productId) ?? null;
    const rule = getIngredientCustomizationRule(item.name);
    const parsed = parseIngredientNote(item.notes);

    setItemCustomizerState({
      mode: "edit",
      product,
      productName: item.name,
      lineId: item.lineId,
      requiredCount: rule?.requiredCount ?? parsed.ingredients.length,
      selectedIngredients: parsed.ingredients,
      note: parsed.note,
    });
  };

  const closeItemCustomizer = () => {
    setItemCustomizerState({
      mode: "add",
      product: null,
      productName: null,
      lineId: null,
      requiredCount: 0,
      selectedIngredients: [],
      note: "",
    });
  };

  const handleToggleIngredient = (ingredient: string) => {
    setItemCustomizerState((prev) => {
      const exists = prev.selectedIngredients.includes(ingredient);
      if (exists) {
        return {
          ...prev,
          selectedIngredients: prev.selectedIngredients.filter(
            (item) => item !== ingredient,
          ),
        };
      }

      if (prev.selectedIngredients.length >= prev.requiredCount) {
        return prev;
      }

      return {
        ...prev,
        selectedIngredients: [...prev.selectedIngredients, ingredient],
      };
    });
  };

  const handleConfirmItemCustomization = () => {
    const {
      mode,
      product,
      lineId,
      requiredCount,
      selectedIngredients,
      note,
    } = itemCustomizerState;

    if (selectedIngredients.length !== requiredCount) {
      return;
    }

    const notes = buildIngredientNote(selectedIngredients, note);

    if (mode === "add" && product) {
      setCartItems((prev) => [
        ...prev,
        {
          lineId: createLineId(),
          productId: product.id,
          name: product.name,
          price_cents: product.price_cents,
          station: product.station,
          qty: 1,
          notes,
          noIngredients: [],
          isAlitas: false,
          isIngredientCustomized: true,
        },
      ]);
      closeItemCustomizer();
      return;
    }

    if (mode === "edit" && lineId) {
      setCartItems((prev) =>
        prev.map((item) =>
          item.lineId === lineId ? { ...item, notes, isIngredientCustomized: true } : item,
        ),
      );
      closeItemCustomizer();
    }
  };

  const openAlitasSelectorForAdd = (product: Product) => {
    setAlitasSelectorState({
      mode: "add",
      product,
      productName: product.name,
      lineId: null,
    });
  };

  const openAlitasSelectorForEdit = (item: CartItem) => {
    const product = products.find((productItem) => productItem.id === item.productId) ?? null;

    setAlitasSelectorState({
      mode: "edit",
      product,
      productName: item.name,
      lineId: item.lineId,
    });
  };

  const closeAlitasSelector = () => {
    setAlitasSelectorState({
      mode: "add",
      product: null,
      productName: null,
      lineId: null,
    });
  };

  const handleSelectAlitasFlavor = (flavor: string) => {
    const notes = buildFlavorNote(flavor);

    if (alitasSelectorState.mode === "add" && alitasSelectorState.product) {
      handleAddAlitasWithFlavor(alitasSelectorState.product, flavor);
      closeAlitasSelector();
      return;
    }

    if (alitasSelectorState.mode === "edit" && alitasSelectorState.lineId) {
      setCartItems((prev) =>
        prev.map((item) =>
          item.lineId === alitasSelectorState.lineId ? { ...item, notes } : item,
        ),
      );
      closeAlitasSelector();
    }
  };

  const handleAddItem = (product: Product) => {
    const ingredientRule = getIngredientCustomizationRule(product.name);

    if (ingredientRule) {
      openItemCustomizerForAdd(product, ingredientRule.requiredCount);
      return;
    }

    if (isAlitasProduct(product)) {
      openAlitasSelectorForAdd(product);
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.notes.trim() === "",
      );
      if (existing) {
        return prev.map((item) =>
          item.lineId === existing.lineId
            ? { ...item, qty: item.qty + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          lineId: createLineId(),
          productId: product.id,
          name: product.name,
          price_cents: product.price_cents,
          station: product.station,
          qty: 1,
          notes: "",
          noIngredients: [],
          isAlitas: false,
          isIngredientCustomized: false,
        },
      ];
    });
  };

  const handleQtyChange = (lineId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.lineId === lineId ? { ...item, qty: item.qty + delta } : item,
        )
        .filter((item) => item.qty > 0),
    );
  };

  const openWithoutModal = (item: CartItem) => {
    setWithoutModalState({
      lineId: item.lineId,
      selectedWithout: [...item.noIngredients],
    });
  };

  const closeWithoutModal = () => {
    setWithoutModalState(null);
  };

  const toggleWithoutIngredient = (ingredient: string) => {
    setWithoutModalState((prev) => {
      if (!prev) {
        return prev;
      }

      const exists = prev.selectedWithout.includes(ingredient);
      return {
        ...prev,
        selectedWithout: exists
          ? prev.selectedWithout.filter((item) => item !== ingredient)
          : [...prev.selectedWithout, ingredient],
      };
    });
  };

  const saveWithoutIngredients = () => {
    if (!withoutModalState) {
      return;
    }

    setCartItems((prev) =>
      prev.map((item) =>
        item.lineId === withoutModalState.lineId
          ? { ...item, noIngredients: withoutModalState.selectedWithout }
          : item,
      ),
    );
    closeWithoutModal();
  };

  const clearWithoutIngredients = (lineId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.lineId === lineId ? { ...item, noIngredients: [] } : item,
      ),
    );
  };

  const handleResetOrder = () => {
    setOrderType(null);
    setCartItems([]);
    setOrderNotes("");
    setOrderConfirmation(null);
    setSubmitError(null);
    setPrintError(null);
    setIsConfirmOpen(false);
    setIsCartSheetOpen(false);
    closeAlitasSelector();
    closeItemCustomizer();
  };

  const handleClearCart = () => {
    setCartItems([]);
    setSubmitError(null);
    closeAlitasSelector();
    closeItemCustomizer();
  };

  const markCustomerPrinted = useCallback(async (orderId: string) => {
    await fetch(`/api/orders/${orderId}/printed`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "customer" }),
    });
  }, []);

  const handlePrintCustomerTicket = useCallback(
    async (orderId: string, ticketText: string) => {
      setIsPrinting(true);
      setPrintError(null);
      try {
        await printRawBT(ticketText);
        await markCustomerPrinted(orderId);
      } catch (error) {
        setPrintError(
          error instanceof Error
            ? `No se pudo imprimir: ${error.message}`
            : "No se pudo imprimir el ticket.",
        );
      } finally {
        setIsPrinting(false);
      }
    },
    [markCustomerPrinted],
  );

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
            product_id: item.productId,
            name_snapshot: item.name,
            price_cents_snapshot: item.price_cents,
            qty: item.qty,
            station: item.station,
            notes: formatItemNotes(item) || null,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const errorMessage =
          typeof payload?.error === "string"
            ? payload.error
            : payload?.error
              ? JSON.stringify(payload.error)
              : "No se pudo crear el pedido.";
        throw new Error(errorMessage);
      }

      const orderId = String(payload?.order_id ?? "");
      const ticketText = String(payload?.ticket_text ?? "");

      setOrderConfirmation({
        orderNumber: payload?.order_number ?? 0,
        orderId,
        items: cartItems,
        type: orderType,
        ticketText,
      });
      if (orderId && ticketText) {
        await handlePrintCustomerTicket(orderId, ticketText);
      } else {
        setPrintError("No se recibió el ticket para imprimir.");
      }

      setCartItems([]);
      setOrderNotes("");
      setIsConfirmOpen(false);
      setIsCartSheetOpen(false);
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

  const handleRetryPrint = async () => {
    if (!orderConfirmation) {
      return;
    }
    await handlePrintCustomerTicket(
      orderConfirmation.orderId,
      orderConfirmation.ticketText,
    );
  };

  const handleOpenConfirm = () => {
    setIsConfirmOpen(true);
    setIsCartSheetOpen(false);
    closeAlitasSelector();
    closeItemCustomizer();
  };

  if (!orderType && !orderConfirmation) {
    return (
      <div className="min-h-screen bg-transparent px-6 py-10 text-ink sm:px-10">
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          <TopBar>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Kiosco local
              </p>
              <h1 className="text-4xl font-bold text-ink">Nuevo pedido</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isStaffMode ? (
                <>
                  <Link href="/cocina" className={topBarPrimaryLink}>
                    Cocina
                  </Link>
                  <Link href="/ui-kit" className={topBarSecondaryLink}>
                    UI Kit
                  </Link>
                </>
              ) : null}
              <StatusBadge status="nuevo" />
            </div>
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
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
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
      <div className="min-h-screen bg-transparent px-6 py-10 text-ink sm:px-10">
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          <TopBar>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Pedido confirmado
              </p>
              <h1 className="text-4xl font-bold text-ink">
                ¡Gracias por tu compra!
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isStaffMode ? (
                <>
                  <Link href="/cocina" className={topBarPrimaryLink}>
                    Cocina
                  </Link>
                  <Link href="/ui-kit" className={topBarSecondaryLink}>
                    UI Kit
                  </Link>
                </>
              ) : null}
              <StatusBadge status="listo" />
            </div>
          </TopBar>

          <Card className="space-y-6 text-center">
            {printError ? (
              <CardDescription className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-left text-rose-700">
                {printError}
              </CardDescription>
            ) : (
              <CardDescription className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-left text-emerald-700">
                Ticket enviado a impresión.
              </CardDescription>
            )}
            <div className="space-y-3">
              <p className="text-lg font-semibold text-muted">
                Pedido #
                {String(orderConfirmation.orderNumber).padStart(3, "0")}
              </p>
              <p className="text-6xl font-bold text-ink">
                {String(orderConfirmation.orderNumber).padStart(3, "0")}
              </p>
              <p className="text-base text-muted">
                {typeLabels[orderConfirmation.type]}
              </p>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Resumen
              </p>
              <ul className="mt-3 space-y-2 text-base font-semibold text-ink">
                {orderConfirmation.items.map((item) => (
                  <li
                    key={item.lineId}
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
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Pedido ID
              </p>
              <p className="text-lg font-semibold">
                #{orderConfirmation.orderId}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="xl"
                variant="secondary"
                onClick={() => void handleRetryPrint()}
                disabled={isPrinting}
              >
                {isPrinting ? "Imprimiendo..." : "Reimprimir ticket"}
              </Button>
              <Button size="xl" onClick={handleResetOrder}>
                Nuevo pedido
              </Button>
            </div>
          </BottomActions>
        </section>
      </div>
    );
  }

  const cartItemsContent =
    cartItems.length === 0 ? (
      <p className="text-base text-muted">
        Agrega productos para comenzar el pedido.
      </p>
    ) : (
      <div className="space-y-4">
        {cartItems.map((item) => (
          <div
            key={item.lineId}
            className="space-y-2 rounded-2xl border border-border bg-surface-2/90 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-ink">{item.name}</p>
                <p className="text-sm text-muted">
                  {stationLabels[item.station]} •{" "}
                  {formatCurrency(item.price_cents)}
                </p>
                {item.notes.trim() ? (
                  <p className="text-sm text-muted">{item.notes}</p>
                ) : null}
                {item.noIngredients.length > 0 ? (
                  <p className="text-sm text-muted">
                    {formatNotesFromWithout(item.noIngredients)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => handleQtyChange(item.lineId, -1)}
                  type="button"
                >
                  -
                </Button>
                <span className="text-lg font-semibold">{item.qty}</span>
                <Button
                  size="md"
                  onClick={() => handleQtyChange(item.lineId, 1)}
                  type="button"
                >
                  +
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {item.isAlitas ? (
                <Button
                  size="md"
                  variant="secondary"
                  type="button"
                  onClick={() => openAlitasSelectorForEdit(item)}
                >
                  Cambiar sabor
                </Button>
              ) : null}
              {item.isIngredientCustomized ? (
                <Button
                  size="md"
                  variant="secondary"
                  type="button"
                  onClick={() => openItemCustomizerForEdit(item)}
                >
                  Editar ingredientes
                </Button>
              ) : null}
              <Button
                size="md"
                variant="secondary"
                type="button"
                onClick={() => openWithoutModal(item)}
              >
                Personalizar
              </Button>
              {item.noIngredients.length > 0 ? (
                <Button
                  size="md"
                  variant="secondary"
                  type="button"
                  onClick={() => clearWithoutIngredients(item.lineId)}
                >
                  Limpiar
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );

  return (
    <div className="min-h-screen bg-transparent px-6 pb-28 pt-10 text-ink sm:px-10 md:pb-10">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <TopBar>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">
              Kiosco local
            </p>
            <h1 className="text-3xl font-bold text-ink">Menú</h1>
            <p className="text-base font-semibold text-muted">
              {orderType ? typeLabels[orderType] : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isStaffMode ? (
              <>
                <Link href="/cocina" className={topBarPrimaryLink}>
                  Cocina
                </Link>
                <Link href="/ui-kit" className={topBarSecondaryLink}>
                  UI Kit
                </Link>
              </>
            ) : null}
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

        <div className="grid gap-6 md:grid-cols-[1.6fr_0.9fr]">
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
              <Card className="space-y-4 border-rose-200 bg-rose-50/70">
                <p className="text-lg font-semibold text-rose-800">
                  {productsError}
                </p>
                <Button
                  size="md"
                  variant="secondary"
                  onClick={() => void loadProducts(true)}
                  type="button"
                >
                  Reintentar
                </Button>
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
                        imageUrl={product.image_url}
                        onAction={() => handleAddItem(product)}
                        actionLabel="Agregar"
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <aside
            id="kiosco-cart"
            className="hidden md:sticky md:top-[72px] md:flex md:max-h-[calc(100vh-96px)] md:flex-col md:gap-6"
          >
            <Card className="flex min-h-0 flex-1 flex-col space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Carrito</CardTitle>
                <span className="text-sm font-semibold text-muted">
                  {cartCount} items
                </span>
              </div>
              <div className="min-h-0 space-y-4 overflow-y-auto pr-2">
                {cartItemsContent}
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>Resumen</CardTitle>
                <span className="text-sm font-semibold text-muted">
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
              {submitError ? (
                <p className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
                  {submitError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button
                  size="xl"
                  onClick={handleOpenConfirm}
                  disabled={cartItems.length === 0}
                >
                  Confirmar pedido
                </Button>
                {cartItems.length > 0 ? (
                  <Button
                    size="xl"
                    variant="secondary"
                    onClick={handleClearCart}
                    type="button"
                  >
                    Vaciar
                  </Button>
                ) : null}
              </div>
            </Card>
          </aside>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Carrito
            </p>
            <p className="text-sm font-semibold text-ink">
              {cartCount} items · {formatCurrency(subtotalCents)}
            </p>
          </div>
          <Button
            size="lg"
            className="relative"
            onClick={() => setIsCartSheetOpen(true)}
            disabled={cartItems.length === 0}
          >
            Ver carrito
            <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-cta px-2 text-xs font-bold text-on-primary">
              {cartCount}
            </span>
          </Button>
        </div>
      </div>

      {isCartSheetOpen ? (
        <Modal
          onClose={() => setIsCartSheetOpen(false)}
          className="items-end p-4 md:hidden"
        >
          <ModalPanel className="max-w-lg rounded-b-none rounded-t-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Tu carrito
                </p>
                <h2 className="text-2xl font-bold text-ink">Revisa tu orden</h2>
              </div>
              <Button
                size="md"
                variant="secondary"
                onClick={() => setIsCartSheetOpen(false)}
                type="button"
                aria-label="Cerrar carrito"
              >
                X
              </Button>
            </div>
            <div className="mt-6 space-y-6">
              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Carrito</CardTitle>
                  <span className="text-sm font-semibold text-muted">
                    {cartCount} items
                  </span>
                </div>
                {cartItemsContent}
              </Card>

              <Card className="space-y-4">
                <div className="flex items-center justify-between">
                  <CardTitle>Resumen</CardTitle>
                  <span className="text-sm font-semibold text-muted">
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
                {submitError ? (
                  <p className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
                    {submitError}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="xl"
                    onClick={handleOpenConfirm}
                    disabled={cartItems.length === 0}
                  >
                    Confirmar pedido
                  </Button>
                  {cartItems.length > 0 ? (
                    <Button
                      size="xl"
                      variant="secondary"
                      onClick={handleClearCart}
                      type="button"
                    >
                      Vaciar
                    </Button>
                  ) : null}
                </div>
              </Card>
            </div>
          </ModalPanel>
        </Modal>
      ) : null}

      {isConfirmOpen ? (
        <Modal onClose={() => setIsConfirmOpen(false)}>
          <ModalPanel className="max-w-2xl space-y-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Confirmar pedido
              </p>
              <h2 className="text-2xl font-bold text-ink">
                {orderType ? typeLabels[orderType] : ""}
              </h2>
            </div>
            <div className="space-y-2 text-base text-ink">
              {cartItems.map((item) => (
                <div
                  key={item.lineId}
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
              <p className="rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold text-ink">
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

      {withoutModalState ? (
        <Modal onClose={closeWithoutModal}>
          <ModalPanel className="max-w-xl space-y-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Quitar ingredientes
              </p>
              <h2 className="text-2xl font-bold text-ink">Selecciona lo que va SIN</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {WITHOUT_INGREDIENT_OPTIONS.map((ingredient) => {
                const isSelected = withoutModalState.selectedWithout.includes(ingredient);
                return (
                  <button
                    key={ingredient}
                    type="button"
                    onClick={() => toggleWithoutIngredient(ingredient)}
                    className={`min-h-11 rounded-full border px-4 text-base font-semibold transition-colors ${
                      isSelected
                        ? "border-cta bg-cta text-on-primary"
                        : "border-border bg-surface-2 text-ink hover:bg-surface"
                    }`}
                  >
                    SIN {ingredient}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={closeWithoutModal}
                variant="secondary"
                type="button"
              >
                Cancelar
              </Button>
              <Button size="lg" onClick={saveWithoutIngredients} type="button">
                Guardar
              </Button>
            </div>
          </ModalPanel>
        </Modal>
      ) : null}

      <ItemCustomizerModal
        isOpen={Boolean(itemCustomizerState.productName)}
        productName={itemCustomizerState.productName ?? "Producto"}
        options={INGREDIENT_OPTIONS}
        requiredCount={itemCustomizerState.requiredCount}
        selectedOptions={itemCustomizerState.selectedIngredients}
        note={itemCustomizerState.note}
        onToggleOption={handleToggleIngredient}
        onNoteChange={(value) =>
          setItemCustomizerState((prev) => ({ ...prev, note: value }))
        }
        onConfirm={handleConfirmItemCustomization}
        onClose={closeItemCustomizer}
      />

      {alitasSelectorState.productName ? (
        <Modal onClose={closeAlitasSelector}>
          <ModalPanel className="max-w-lg space-y-4 border-cta/40 bg-surface-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Selecciona sabor
              </p>
              <h2 className="text-2xl font-bold text-ink">
                {alitasSelectorState.productName ?? "Alitas"}
              </h2>
            </div>
            <div className="grid gap-3">
              {ALITAS_FLAVORS.map((flavor) => (
                <Button
                  key={flavor}
                  size="xl"
                  type="button"
                  onClick={() => handleSelectAlitasFlavor(flavor)}
                >
                  {flavor}
                </Button>
              ))}
            </div>
            <Button
              size="lg"
              variant="secondary"
              onClick={closeAlitasSelector}
              type="button"
            >
              Cancelar
            </Button>
          </ModalPanel>
        </Modal>
      ) : null}
    </div>
  );
}
