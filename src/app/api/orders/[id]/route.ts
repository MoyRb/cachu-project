import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/connection';
import { ensureRole, getAuthContext, Role } from '@/lib/auth';

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

function fetchOrder(db: ReturnType<typeof getDb>, orderId: number, role: Role) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) {
    return null;
  }

  const stationFilter = role === 'PLANCHA' || role === 'FREIDORA' ? ' AND station = ?' : '';
  const items = db
    .prepare(`SELECT * FROM order_items WHERE order_id = ?${stationFilter}`)
    .all(
      ...(role === 'PLANCHA'
        ? [orderId, 'PLANCHA']
        : role === 'FREIDORA'
          ? [orderId, 'FREIDORA']
          : [orderId])
    );

  return { ...order, items };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = getAuthContext(request);
    ensureRole(auth.role, ['ADMIN', 'PLANCHA', 'FREIDORA', 'EMPAQUETADO']);

    const { id } = params;
    const orderId = Number(id);
    if (!Number.isInteger(orderId)) {
      return jsonError('Invalid order id');
    }

    const db = getDb();

    if (auth.role === 'PLANCHA' || auth.role === 'FREIDORA') {
      const station = auth.role === 'PLANCHA' ? 'PLANCHA' : 'FREIDORA';
      const visibleOrder = db
        .prepare(
          `SELECT 1 FROM order_items WHERE order_id = ? AND station = ? LIMIT 1`
        )
        .get(orderId, station);
      if (!visibleOrder) {
        return jsonError('Not found', 404);
      }
    }

    const order = fetchOrder(db, orderId, auth.role);
    if (!order) {
      return jsonError('Not found', 404);
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const db = getDb();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return jsonError('Not found', 404);
    }

    db.prepare('UPDATE orders SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      status,
      orderId
    );

    const updated = fetchOrder(db, orderId, auth.role);
    return NextResponse.json({ order: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unauthorized';
    const status = message === 'Forbidden' ? 403 : 401;
    return jsonError(message, status);
  }
}
