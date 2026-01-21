import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { ensureRole, getAuthContext, Role } from '@/lib/auth';

const ORDER_STATUSES = [
  'RECIBIDO',
  'EN_PROCESO',
  'LISTO_PARA_EMPACAR',
  'EMPACANDO',
  'LISTO_PARA_ENTREGAR',
  'EN_REPARTO',
  'ENTREGADO'
] as const;
const ORDER_TYPES = ['DINEIN', 'TAKEOUT', 'DELIVERY'] as const;
const ITEM_STATIONS = ['PLANCHA', 'FREIDORA'] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function buildOrderFilter(role: Role, station: string | null) {
  if (role === 'PLANCHA' || role === 'FREIDORA') {
    return {
      clause:
        'WHERE EXISTS (SELECT 1 FROM order_items WHERE order_items.order_id = orders.id AND station = ?) ',
      params: [station]
    };
  }
  return { clause: 'WHERE 1=1 ', params: [] };
}

function attachFilters(
  clause: string,
  params: unknown[],
  filters: { status?: string | null; type?: string | null; date?: string | null }
) {
  const updatedParams = [...params];
  let updatedClause = clause;
  if (filters.status) {
    updatedClause += 'AND status = ? ';
    updatedParams.push(filters.status);
  }
  if (filters.type) {
    updatedClause += 'AND type = ? ';
    updatedParams.push(filters.type);
  }
  if (filters.date) {
    updatedClause += 'AND order_date = ? ';
    updatedParams.push(filters.date);
  }
  return { clause: updatedClause, params: updatedParams };
}

function fetchOrders(
  role: Role,
  station: string | null,
  filters: { status?: string | null; type?: string | null; date?: string | null }
) {
  const db = getDb();
  const base = buildOrderFilter(role, station);
  const withFilters = attachFilters(base.clause, base.params, filters);

  const orders = db
    .prepare(`SELECT * FROM orders ${withFilters.clause} ORDER BY created_at DESC`)
    .all(...withFilters.params);

  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => '?').join(',');
  const stationFilter = role === 'PLANCHA' || role === 'FREIDORA' ? ' AND station = ?' : '';
  const items = db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})${stationFilter}`)
    .all(
      ...(role === 'PLANCHA' || role === 'FREIDORA'
        ? [...orderIds, station]
        : orderIds)
    );

  const itemsByOrder = new Map<number, any[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? []
  }));
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'PLANCHA', 'FREIDORA', 'EMPAQUETADO']);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const date = searchParams.get('date');

    if (status && !ORDER_STATUSES.includes(status as typeof ORDER_STATUSES[number])) {
      return jsonError('Invalid status filter');
    }
    if (type && !ORDER_TYPES.includes(type as typeof ORDER_TYPES[number])) {
      return jsonError('Invalid type filter');
    }

    const station = auth.role === 'PLANCHA' ? 'PLANCHA' : auth.role === 'FREIDORA' ? 'FREIDORA' : null;
    const orders = fetchOrders(auth.role, station, { status, type, date });

    return NextResponse.json({ orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'EMPAQUETADO']);

    const payload = await request.json();
    const { type, customer_name, customer_phone, address_json, notes, items, delivery_fee_cents } = payload ?? {};

    if (!ORDER_TYPES.includes(type)) {
      return jsonError('Invalid order type');
    }
    if (!Array.isArray(items) || items.length === 0) {
      return jsonError('Items are required');
    }

    const normalizedItems = items.map((item: any) => ({
      product_id: item.product_id ?? null,
      name_snapshot: String(item.name_snapshot ?? item.name ?? '').trim(),
      price_cents_snapshot: Number(item.price_cents_snapshot ?? item.price_cents),
      qty: Number(item.qty ?? 1),
      station: item.station,
      status: item.status ?? 'EN_COLA',
      notes: item.notes ?? null,
      group_id: item.group_id ?? null
    }));

    for (const item of normalizedItems) {
      if (!item.name_snapshot) {
        return jsonError('Item name is required');
      }
      if (!Number.isInteger(item.price_cents_snapshot) || item.price_cents_snapshot < 0) {
        return jsonError('Invalid item price');
      }
      if (!Number.isInteger(item.qty) || item.qty <= 0) {
        return jsonError('Invalid item qty');
      }
      if (!ITEM_STATIONS.includes(item.station)) {
        return jsonError('Invalid item station');
      }
    }

    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const lastOrder = db
      .prepare('SELECT MAX(order_number) as maxNumber FROM orders WHERE order_date = ?')
      .get(today) as { maxNumber: number | null };
    const nextOrderNumber = (lastOrder?.maxNumber ?? 0) + 1;
    const deliveryFee = Number.isInteger(delivery_fee_cents) ? delivery_fee_cents : 0;
    const subtotal = normalizedItems.reduce(
      (sum: number, item: any) => sum + item.price_cents_snapshot * item.qty,
      0
    );
    const total = subtotal + deliveryFee;

    const insertOrder = db.prepare(
      `INSERT INTO orders
        (order_date, order_number, type, status, customer_name, customer_phone, address_json, notes, subtotal_cents, delivery_fee_cents, total_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items
        (order_id, product_id, name_snapshot, price_cents_snapshot, qty, station, status, notes, group_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const transaction = db.transaction(() => {
      const orderResult = insertOrder.run(
        today,
        nextOrderNumber,
        type,
        'RECIBIDO',
        customer_name ?? null,
        customer_phone ?? null,
        address_json ? JSON.stringify(address_json) : null,
        notes ?? null,
        subtotal,
        deliveryFee,
        total
      );
      const orderId = Number(orderResult.lastInsertRowid);

      for (const item of normalizedItems) {
        insertItem.run(
          orderId,
          item.product_id,
          item.name_snapshot,
          item.price_cents_snapshot,
          item.qty,
          item.station,
          item.status,
          item.notes,
          item.group_id
        );
      }

      return orderId;
    });

    const orderId = transaction();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db
      .prepare('SELECT * FROM order_items WHERE order_id = ?')
      .all(orderId);

    return NextResponse.json({ order: { ...order, items: orderItems } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}
