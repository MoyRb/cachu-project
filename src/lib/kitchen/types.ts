export type OrderStatus =
  | "RECIBIDO"
  | "EN_PROCESO"
  | "LISTO_PARA_EMPACAR"
  | "EMPACANDO"
  | "LISTO_PARA_ENTREGAR"
  | "EN_REPARTO"
  | "ENTREGADO";

export type OrderType = "DINEIN" | "TAKEOUT" | "DELIVERY";

export type ItemStatus = "EN_COLA" | "PENDIENTE" | "EN_PREPARACION" | "LISTO";

export type PaymentStatus = "AWAITING_PAYMENT" | "PAID" | "CANCELLED";

export type OrderItem = {
  id: number | string;
  order_item_id?: number | string;
  order_id: number | string;
  name_snapshot: string;
  qty: number;
  price_cents_snapshot?: number | null;
  status: ItemStatus;
  notes?: string | null;
  station: "PLANCHA" | "FREIDORA";
  created_at?: string;
  updated_at?: string;
};

export type Order = {
  id: number;
  order_number: number;
  created_at: string;
  updated_at?: string;
  status: OrderStatus;
  type: OrderType;
  payment_status?: PaymentStatus | null;
  paid_at?: string | null;
  paid_by?: string | null;
  notes?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address_json?: Record<string, unknown> | null;
  subtotal_cents?: number | null;
  delivery_fee_cents?: number | null;
  total_cents?: number | null;
  items: OrderItem[];
};
