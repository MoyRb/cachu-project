import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, getAuthContext } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const ITEM_STATUSES = ['EN_COLA', 'PENDIENTE', 'EN_PREPARACION', 'LISTO'] as const;
const ORDER_READY_STATUSES = ['RECIBIDO', 'EN_PROCESO'] as const;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rawRoleHeader = request.headers.get('x-role');
    const rawUserIdHeader = request.headers.get('x-user-id');
    if (process.env.NODE_ENV !== 'production') {
      console.log('[order-items] kitchen headers:', {
        hasRole: Boolean(rawRoleHeader),
        hasUserId: Boolean(rawUserIdHeader),
      });
    }

    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'PLANCHA', 'FREIDORA']);

    const rawId = (params.id ?? '').trim();
    if (!rawId) {
      return jsonError('Invalid item id');
    }

    const isCompositeId = rawId.includes(':');
    let itemId: number | null = null;
    let lookupOrderId: number | null = null;
    let lookupProductId: number | null = null;

    if (isCompositeId) {
      const [orderIdPart, productIdPart] = rawId.split(':');
      const orderId = Number((orderIdPart ?? '').trim());
      const productId = Number((productIdPart ?? '').trim());
      if (Number.isNaN(orderId) || Number.isNaN(productId)) {
        return jsonError('Invalid item id');
      }
      lookupOrderId = orderId;
      lookupProductId = productId;
    } else {
      const parsedId = Number(rawId);
      if (Number.isNaN(parsedId)) {
        return jsonError('Invalid item id');
      }
      itemId = parsedId;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[order-items] auth context:', {
        role: auth.role,
        userId: auth.userId,
        itemId: itemId ?? `${lookupOrderId}:${lookupProductId}`,
      });
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

    const { status } = await request.json();
    if (!ITEM_STATUSES.includes(status)) {
      return jsonError('Invalid status');
    }

    const itemQuery = supabase
      .from('order_items')
      .select('id, station, order_id, product_id');
    const { data: item, error: itemError } = lookupOrderId && lookupProductId
      ? await itemQuery
          .eq('order_id', lookupOrderId)
          .eq('product_id', lookupProductId)
          .single()
      : await itemQuery.eq('id', itemId).single();
    if (itemError || !item) {
      return jsonError('No se encontró el ítem solicitado.', 404);
    }
    itemId = Number(item.id);

    if (
      (auth.role === 'PLANCHA' && item.station !== 'PLANCHA') ||
      (auth.role === 'FREIDORA' && item.station !== 'FREIDORA')
    ) {
      return jsonError('Forbidden', 403);
    }

    const { error: updateError } = await supabase
      .from('order_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (updateError) {
      throw new Error(updateError.message);
    }

    if (status === 'LISTO') {
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

    const { data: updated, error: updatedError } = await supabase
      .from('order_items')
      .select('*')
      .eq('id', itemId)
      .single();
    if (updatedError || !updated) {
      throw new Error(updatedError?.message ?? 'Item not found');
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
