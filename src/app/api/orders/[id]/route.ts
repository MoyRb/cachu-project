import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, getAuthContext, Role } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const ORDER_STATUSES = [
  'RECIBIDO',
  'EN_PROCESO',
  'LISTO_PARA_EMPACAR',
  'EMPACANDO',
  'LISTO_PARA_ENTREGAR',
  'EN_REPARTO',
  'ENTREGADO'
] as const;

const EMPAQUETADO_ALLOWED = ['EMPACANDO', 'LISTO_PARA_ENTREGAR', 'EN_REPARTO', 'ENTREGADO'] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchOrder(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  orderId: number,
  role: Role
) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (error || !order) {
    return null;
  }

  let itemsQuery = supabase.from('order_items').select('*').eq('order_id', orderId);
  if (role === 'PLANCHA') {
    itemsQuery = itemsQuery.eq('station', 'PLANCHA');
  } else if (role === 'FREIDORA') {
    itemsQuery = itemsQuery.eq('station', 'FREIDORA');
  }

  const { data: items, error: itemsError } = await itemsQuery;
  if (itemsError) {
    throw new Error(itemsError.message);
  }

  return { ...order, items: items ?? [] };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'PLANCHA', 'FREIDORA', 'EMPAQUETADO']);

    const { id } = params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return jsonError('Invalid order id');
    }

    const order = await fetchOrder(supabase, orderId, auth.role);
    if (!order) {
      return jsonError('Not found', 404);
    }

    if (
      (auth.role === 'PLANCHA' || auth.role === 'FREIDORA') &&
      order.items.length === 0
    ) {
      return jsonError('Not found', 404);
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status =
      message === 'Forbidden'
        ? 403
        : message.startsWith('Server misconfigured')
          ? 500
          : 401;
    return jsonError(message, status);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'EMPAQUETADO']);

    const { id } = params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return jsonError('Invalid order id');
    }

    const { status } = await request.json();
    if (!ORDER_STATUSES.includes(status)) {
      return jsonError('Invalid status');
    }

    if (auth.role === 'EMPAQUETADO' && !EMPAQUETADO_ALLOWED.includes(status)) {
      return jsonError('Forbidden', 403);
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .single();
    if (orderError || !order) {
      return jsonError('Not found', 404);
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (updateError) {
      throw new Error(updateError.message);
    }

    const updated = await fetchOrder(supabase, orderId, auth.role);
    return NextResponse.json({ order: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status =
      message === 'Forbidden'
        ? 403
        : message.startsWith('Server misconfigured')
          ? 500
          : 401;
    return jsonError(message, status);
  }
}
