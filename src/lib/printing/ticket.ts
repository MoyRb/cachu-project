export type TicketOrderType = 'DINEIN' | 'TAKEOUT' | 'DELIVERY';

export interface TicketItem {
  name_snapshot: string;
  qty: number;
  station: 'PLANCHA' | 'FREIDORA' | string;
  price_cents_snapshot?: number | null;
  notes?: string | null;
}

export interface TicketOrder {
  order_number: number;
  type: TicketOrderType;
  status: string;
  created_at?: string | null;
  items: TicketItem[];
  notes?: string | null;
  delivery_fee_cents?: number | null;
  total_cents?: number | null;
}

const typeLabels: Record<TicketOrderType, string> = {
  DINEIN: 'Comer aquí',
  TAKEOUT: 'Para llevar',
  DELIVERY: 'Delivery'
};

const formatCurrency = (valueCents: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  }).format(valueCents / 100);

export function buildTicketText(order: TicketOrder): string {
  const subtotal = order.items.reduce(
    (sum, item) => sum + (item.price_cents_snapshot ?? 0) * item.qty,
    0
  );
  const deliveryFee = order.delivery_fee_cents ?? 0;
  const total = order.total_cents ?? subtotal + deliveryFee;

  const lines: string[] = [
    'Ticket de pedido',
    `Pedido #${String(order.order_number).padStart(3, '0')}`,
    `Tipo: ${typeLabels[order.type]}`,
    `Estado: ${order.status}`,
    `Creado: ${order.created_at ? new Date(order.created_at).toLocaleString('es-CL') : '--'}`,
    '',
    'Items'
  ];

  for (const item of order.items) {
    lines.push(`- ${item.name_snapshot}`);
    lines.push(`  ${item.station} · x${item.qty} · ${formatCurrency((item.price_cents_snapshot ?? 0) * item.qty)}`);
    if (item.notes) {
      lines.push(`  Nota: ${item.notes}`);
    }
  }

  lines.push('');
  lines.push(`Subtotal: ${formatCurrency(subtotal)}`);
  if (deliveryFee > 0) {
    lines.push(`Envío: ${formatCurrency(deliveryFee)}`);
  }
  lines.push(`Total: ${formatCurrency(total)}`);

  if (order.notes) {
    lines.push('');
    lines.push('Notas del pedido');
    lines.push(order.notes);
  }

  return `${lines.join('\n')}\n`;
}
