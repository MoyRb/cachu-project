import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, getAuthContext } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'PLANCHA', 'FREIDORA', 'EMPAQUETADO']);

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return jsonError('Invalid order id');
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('orders')
      .select('ticket_text')
      .eq('id', orderId)
      .single();

    if (error || !data) {
      return jsonError('Not found', 404);
    }

    return NextResponse.json({ ticket_text: data.ticket_text ?? '' });
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
