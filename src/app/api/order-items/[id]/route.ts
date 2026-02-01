import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, getAuthContext } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'PLANCHA', 'FREIDORA']);

    const rawId = params.id.trim();
    const numericIdMatch = /^\d+$/.exec(rawId);
    const isCompositeId = rawId.includes(':');
    let itemId: string | null = null;
    let lookupOrderId: string | null = null;
    let lookupProductId: string | null = null;

    if (isCompositeId) {
      const [orderIdPart, productIdPart] = rawId.split(':');
      const orderMatch = /^\d+$/.exec(orderIdPart ?? '');
      const productMatch = /^\d+$/.exec(productIdPart ?? '');
      if (!orderMatch || !productMatch) {
        return jsonError('Invalid item id');
      }
      lookupOrderId = orderIdPart;
      lookupProductId = productIdPart;
    } else if (numericIdMatch) {
      itemId = rawId;
    } else {
      return jsonError('Invalid item id');
    }

    const { status } = await request.json();
    if (!ITEM_STATUSES.includes(status)) {
      return jsonError('Invalid status');
    }

    const itemQuery = supabaseAdmin
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
    itemId = String(item.id);

    if (
      (auth.role === 'PLANCHA' && item.station !== 'PLANCHA') ||
      (auth.role === 'FREIDORA' && item.station !== 'FREIDORA')
    ) {
      return jsonError('Forbidden', 403);
    }

    const { error: updateError } = await supabaseAdmin
      .from('order_items')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', itemId);
    if (updateError) {
      throw new Error(updateError.message);
    }

    if (status === 'LISTO') {
      const { count, error: remainingError } = await supabaseAdmin
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', item.order_id)
        .neq('status', 'LISTO');
      if (remainingError) {
        throw new Error(remainingError.message);
      }

      if (count === 0) {
        const { data: order, error: orderError } = await supabaseAdmin
          .from('orders')
          .select('id, status')
          .eq('id', item.order_id)
          .single();
        if (orderError || !order) {
          throw new Error(orderError?.message ?? 'Order not found');
        }

        if (ORDER_READY_STATUSES.includes(order.status)) {
          const { error: orderUpdateError } = await supabaseAdmin
            .from('orders')
            .update({ status: 'LISTO_PARA_EMPACAR', updated_at: new Date().toISOString() })
            .eq('id', item.order_id);
          if (orderUpdateError) {
            throw new Error(orderUpdateError.message);
          }
        }
      }
    }

    const { data: updated, error: updatedError } = await supabaseAdmin
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
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}
