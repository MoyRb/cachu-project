import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, getAuthContext, Role } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
const ITEM_STATUSES = ['EN_COLA', 'PENDIENTE', 'EN_PREPARACION', 'LISTO'] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchOrders(
  role: Role,
  station: string | null,
  filters: { status?: string | null; type?: string | null; date?: string | null }
) {
  let query = supabaseAdmin.from('orders').select('*').order('created_at', { ascending: false });
  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.type) {
    query = query.eq('type', filters.type);
  }
  if (filters.date) {
    query = query.eq('order_date', filters.date);
  }

  const { data: orders, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  if (!orders || orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  let itemsQuery = supabaseAdmin.from('order_items').select('*').in('order_id', orderIds);
  if (station) {
    itemsQuery = itemsQuery.eq('station', station);
  }
  const { data: items, error: itemsError } = await itemsQuery;
  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const itemsByOrder = new Map<number, any[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  const filteredOrders =
    role === 'PLANCHA' || role === 'FREIDORA'
      ? orders.filter((order) => (itemsByOrder.get(order.id) ?? []).length > 0)
      : orders;

  return filteredOrders.map((order) => ({
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

    const station =
      auth.role === 'PLANCHA' ? 'PLANCHA' : auth.role === 'FREIDORA' ? 'FREIDORA' : null;
    const orders = await fetchOrders(auth.role, station, { status, type, date });

    return NextResponse.json({ orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function POST(request: NextRequest) {
  try {
    let auth: { role: Role } | null = null;
    try {
      auth = getAuthContext(request);
    } catch {
      auth = null;
    }
    if (auth) {
      ensureRole(auth.role, ['ADMIN', 'EMPAQUETADO']);
    }

    const payload = await request.json();
    const { type, customer_name, customer_phone, address_json, notes, items, delivery_fee_cents } = payload ?? {};

    if (!ORDER_TYPES.includes(type)) {
      return jsonError('Invalid order type');
    }
    if (!auth && type === 'DELIVERY') {
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
      if (item.status && !ITEM_STATUSES.includes(item.status)) {
        return jsonError('Invalid item status');
      }
    }

    const deliveryFee = Number.isInteger(delivery_fee_cents) ? delivery_fee_cents : 0;
    const subtotal = normalizedItems.reduce(
      (sum: number, item: any) => sum + item.price_cents_snapshot * item.qty,
      0
    );
    const total = subtotal + deliveryFee;

    const { data: orderId, error: createError } = await supabaseAdmin.rpc(
      'create_order_with_items',
      {
        p_type: type,
        p_customer_name: customer_name ?? null,
        p_customer_phone: customer_phone ?? null,
        p_address_json: address_json ?? null,
        p_notes: notes ?? null,
        p_subtotal_cents: subtotal,
        p_delivery_fee_cents: deliveryFee,
        p_total_cents: total,
        p_items: normalizedItems
      }
    );

    if (createError || !orderId) {
      throw new Error(createError?.message ?? 'Failed to create order');
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Order not found');
    }

    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    if (itemsError) {
      throw new Error(itemsError.message);
    }

    return NextResponse.json(
      { order: { ...order, items: orderItems ?? [] } },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}
