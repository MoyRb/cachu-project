import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, Role } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const ITEM_STATUSES = ['EN_COLA', 'PENDIENTE', 'EN_PREPARACION', 'LISTO'] as const;
const ORDER_READY_STATUSES = ['RECIBIDO', 'EN_PROCESO'] as const;
const KITCHEN_ROLES: Role[] = ['ADMIN', 'PLANCHA', 'FREIDORA'];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roleHeader = request.headers.get('x-role') ?? '';
    const userIdHeader = request.headers.get('x-user-id') ?? '';
    const role = roleHeader.trim().toUpperCase();
    const userId = userIdHeader.trim();

    if (!role || !userId) {
      return jsonError('Missing authentication headers', 401);
    }
    if (!KITCHEN_ROLES.includes(role as Role)) {
      return jsonError('Invalid role', 401);
    }
    ensureRole(role as Role, KITCHEN_ROLES);

    const parsedUserId = Number(userId);
    if (!Number.isFinite(parsedUserId) || parsedUserId <= 0) {
      return jsonError('Invalid user id', 400);
    }

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isFinite(itemId) || itemId <= 0) {
      return jsonError(`Invalid item id: ${id}`);
    }

    let supabase;
    try {
      supabase = getSupabaseAdmin();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server misconfigured';
      if (process.env.NODE_ENV !== 'production') {
        console.error('[order-items] supabase config error:', message);
      }
      return jsonError(message, 500);
    }

    let body: Record<string, unknown> = {};
    try {
      const rawBody = await request.text();
      if (rawBody) {
        body = JSON.parse(rawBody);
      }
    } catch (error) {
      return jsonError('Invalid JSON');
    }

    const desiredRaw = body.status ?? body.nextStatus ?? body.next_status;
    if (typeof desiredRaw !== 'string') {
      return jsonError('Missing status');
    }
    const desired = desiredRaw.trim();
    if (!desired) {
      return jsonError('Missing status');
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('[order-items] PATCH', {
        paramsId: id,
        itemId,
        desired,
        roleHeader,
        userIdHeader,
      });
    }
    if (!ITEM_STATUSES.includes(desired as (typeof ITEM_STATUSES)[number])) {
      return jsonError('Invalid status');
    }

    const { data: item, error: itemError } = await supabase
      .from('order_items')
      .select('id, station, order_id, product_id')
      .eq('id', itemId)
      .maybeSingle();
    if (itemError) {
      return jsonError(`Supabase error: ${itemError.message}`, 500);
    }
    if (!item) {
      return jsonError('Order item not found', 404);
    }

    if (
      (role === 'PLANCHA' && item.station !== 'PLANCHA') ||
      (role === 'FREIDORA' && item.station !== 'FREIDORA')
    ) {
      return jsonError('Forbidden', 403);
    }

    const { data: updated, error: updateError } = await supabase
      .from('order_items')
      .update({ status: desired, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select('*')
      .maybeSingle();
    if (updateError) {
      return jsonError(`Supabase error: ${updateError.message}`, 500);
    }
    if (!updated) {
      return jsonError('Order item not found', 404);
    }

    if (desired === 'LISTO') {
      const { count, error: remainingError } = await supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', item.order_id)
        .neq('status', 'LISTO');
      if (remainingError) {
        throw new Error(remainingError.message);
      }

      if (count === 0) {
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('id, status')
          .eq('id', item.order_id)
          .single();
        if (orderError || !order) {
          throw new Error(orderError?.message ?? 'Order not found');
        }

        if (ORDER_READY_STATUSES.includes(order.status)) {
          const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({ status: 'LISTO_PARA_EMPACAR', updated_at: new Date().toISOString() })
            .eq('id', item.order_id);
          if (orderUpdateError) {
            throw new Error(orderUpdateError.message);
          }
        }
      }
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    if (process.env.NODE_ENV !== 'production') {
      console.error('[order-items] error:', message);
    }

    if (message === 'Forbidden') {
      return jsonError(message, 403);
    }
    if (message === 'Invalid user id') {
      return jsonError(message, 400);
    }
    if (message.startsWith('Server misconfigured')) {
      return jsonError(message, 500);
    }
    if (message === 'Missing kitchen auth headers') {
      return jsonError(message, 401);
    }
    if (message === 'Invalid role') {
      return jsonError(message, 401);
    }

    return jsonError(message, 401);
  }
}
