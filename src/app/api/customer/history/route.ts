import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const authorizationHeader = request.headers.get('authorization') ?? '';
    const bearerToken = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7).trim()
      : '';

    if (!bearerToken) {
      return jsonError('No autorizado.', 401);
    }

    const {
      data: { user },
      error: tokenError,
    } = await supabase.auth.getUser(bearerToken);

    if (tokenError || !user) {
      return jsonError('No autorizado.', 401);
    }

    // customer_id proviene del token validado — nunca del body/query.
    const { data: orders, error: ordersError } = await supabase
      .from('customer_order_history')
      .select(
        'id, order_number, order_date, type, items_json, subtotal_cents, delivery_fee_cents, total_cents, payment_method, points_earned, paid_at, created_at'
      )
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      throw new Error(ordersError.message);
    }

    return NextResponse.json({ orders: orders ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return jsonError(message, 500);
  }
}
