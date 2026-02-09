import { NextRequest, NextResponse } from 'next/server';

import { ensureRole, getAuthContext } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN']);

    const payload = await request.json();
    const orderId = payload?.order_id;
    const amountCents = payload?.amount_cents;
    const method = String(payload?.method ?? 'cash').trim() || 'cash';

    if (!orderId) {
      return jsonError('Order id is required');
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return jsonError('Amount is required');
    }

    const { error: paymentError } = await supabase.from('payments').insert({
      order_id: orderId,
      amount_cents: amountCents,
      method,
    });
    if (paymentError) {
      throw new Error(paymentError.message);
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('id, payment_status, paid_at')
      .single();
    if (orderError || !order) {
      throw new Error(orderError?.message ?? 'Order not found');
    }

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}
