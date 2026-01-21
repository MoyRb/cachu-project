import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { ensureRole, getAuthContext } from '@/lib/auth';

const ITEM_STATUSES = ['EN_COLA', 'PENDIENTE', 'EN_PREPARACION', 'LISTO'] as const;

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

    const itemId = Number(params.id);
    if (!Number.isInteger(itemId)) {
      return jsonError('Invalid item id');
    }

    const { status } = await request.json();
    if (!ITEM_STATUSES.includes(status)) {
      return jsonError('Invalid status');
    }

    const db = getDb();
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId) as
      | { id: number; station: string; order_id: number }
      | undefined;
    if (!item) {
      return jsonError('Not found', 404);
    }

    if (
      (auth.role === 'PLANCHA' && item.station !== 'PLANCHA') ||
      (auth.role === 'FREIDORA' && item.station !== 'FREIDORA')
    ) {
      return jsonError('Forbidden', 403);
    }

    db.prepare('UPDATE order_items SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      status,
      itemId
    );

    if (status === 'LISTO') {
      const remaining = db
        .prepare(
          `SELECT COUNT(*) as remaining FROM order_items
           WHERE order_id = ? AND status != 'LISTO'`
        )
        .get(item.order_id) as { remaining: number };

      if (remaining.remaining === 0) {
        db.prepare(
          `UPDATE orders
           SET status = 'LISTO_PARA_EMPACAR', updated_at = datetime('now')
           WHERE id = ?`
        ).run(item.order_id);
      }
    }

    const updated = db.prepare('SELECT * FROM order_items WHERE id = ?').get(itemId);
    return NextResponse.json({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}
