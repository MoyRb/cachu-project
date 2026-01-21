import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const orderId = Number(payload?.order_id);
  const amountCents = Number(payload?.amount_cents);

  if (payload && Number.isInteger(orderId) && Number.isInteger(amountCents)) {
    const { error } = await supabaseAdmin.from('payments').insert({
      order_id: orderId,
      provider: payload.provider ?? 'unknown',
      status: payload.status ?? 'PENDIENTE',
      external_id: payload.external_id ?? null,
      amount_cents: amountCents,
      currency: payload.currency ?? 'MXN',
      raw_json: payload
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
