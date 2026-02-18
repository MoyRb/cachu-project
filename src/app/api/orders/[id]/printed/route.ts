import { NextRequest, NextResponse } from 'next/server';
import { ensureRole, getAuthContext } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const PRINT_TYPES = ['customer', 'packaging'] as const;

type PrintType = (typeof PRINT_TYPES)[number];

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const getColumnByType = (type: PrintType) =>
  type === 'customer' ? 'printed_customer_at' : 'printed_packaging_at';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const roleHeader = request.headers.get('x-role')?.trim();
    const userIdHeader = request.headers.get('x-user-id')?.trim();
    const isKioskRequest = !roleHeader || !userIdHeader;
    if (!isKioskRequest) {
      const auth = getAuthContext(request);
      ensureRole(auth.role, ['ADMIN', 'EMPAQUETADO']);
    }

    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return jsonError('Invalid order id');
    }

    const { type } = (await request.json()) as { type?: PrintType };
    if (!type || !PRINT_TYPES.includes(type)) {
      return jsonError('Invalid print type');
    }
    if (isKioskRequest && type !== 'customer') {
      return jsonError('Forbidden', 403);
    }

    const column = getColumnByType(type);
    const supabase = getSupabaseAdmin();

    const { data: row, error } = await supabase
      .from('orders')
      .select('id, printed_customer_at, printed_packaging_at')
      .eq('id', orderId)
      .single();

    if (error || !row) {
      return jsonError('Not found', 404);
    }

    const alreadyPrinted =
      type === 'customer' ? Boolean(row.printed_customer_at) : Boolean(row.printed_packaging_at);

    if (!alreadyPrinted) {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ [column]: new Date().toISOString() })
        .eq('id', orderId)
        .is(column, null);
      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    const { data: updated, error: updatedError } = await supabase
      .from('orders')
      .select('printed_customer_at, printed_packaging_at')
      .eq('id', orderId)
      .single();

    if (updatedError || !updated) {
      return jsonError('Not found', 404);
    }

    return NextResponse.json(updated);
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
