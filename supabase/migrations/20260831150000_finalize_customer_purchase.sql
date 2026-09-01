-- supabase/migrations/20260831150000_finalize_customer_purchase.sql
--
-- CORTE 4: Función atómica para cerrar el flujo de compra de un cliente autenticado.
--
-- Responsabilidades:
--   1. Verificar que el pedido esté PAID y tenga customer_id.
--   2. Crear un snapshot permanente en customer_order_history (idempotente).
--   3. Acreditar puntos en loyalty_ledger + loyalty_accounts (idempotente).
--
-- Garantías:
--   - Todo ocurre en una sola transacción PL/pgSQL.
--   - Ejecutar dos veces produce el mismo resultado (sin puntos dobles).
--   - Pedidos anónimos (customer_id IS NULL) terminan sin historial ni puntos.
--   - Puntos = floor(subtotal_cents / 10000). El envío NO genera puntos.
--
-- NO modifica create_order_with_items ni ninguna estructura existente.

CREATE OR REPLACE FUNCTION public.finalize_customer_purchase(p_order_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Campos del pedido
  v_payment_status     text;
  v_customer_id        uuid;
  v_order_number       int;
  v_order_date         date;
  v_order_type         text;
  v_customer_name      text;
  v_customer_phone     text;
  v_address_json       jsonb;
  v_subtotal_cents     int;
  v_delivery_fee_cents int;
  v_total_cents        int;
  v_paid_at            timestamptz;

  -- Resultados intermedios
  v_loyalty_account_id bigint;
  v_items_json         jsonb;
  v_payment_method     text;
  v_points_earned      int;
  v_history_id         bigint;
  v_ledger_created     boolean := false;
BEGIN

  -- ── 1. Bloquear fila del pedido para evitar carreras ─────────────────────
  SELECT
    o.payment_status,
    o.customer_id,
    o.order_number,
    o.order_date,
    o.type::text,
    o.customer_name,
    o.customer_phone,
    o.address_json,
    o.subtotal_cents,
    o.delivery_fee_cents,
    o.total_cents,
    o.paid_at
  INTO
    v_payment_status,
    v_customer_id,
    v_order_number,
    v_order_date,
    v_order_type,
    v_customer_name,
    v_customer_phone,
    v_address_json,
    v_subtotal_cents,
    v_delivery_fee_cents,
    v_total_cents,
    v_paid_at
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;

  -- ── 2. Solo pedidos PAID ──────────────────────────────────────────────────
  IF v_payment_status <> 'PAID' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_paid',
                              'payment_status', v_payment_status);
  END IF;

  -- ── 3. Sin customer_id → pedido anónimo, sin acción de loyalty ───────────
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_customer_id');
  END IF;

  -- ── 4. Buscar y bloquear la cuenta de lealtad del cliente ────────────────
  SELECT id
  INTO v_loyalty_account_id
  FROM public.loyalty_accounts
  WHERE user_id = v_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'loyalty_account_not_found');
  END IF;

  -- ── 5. Construir snapshot de items desde order_items reales ──────────────
  --      Nunca confiar en datos del frontend.
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id',  oi.product_id,
        'name',        oi.name_snapshot,
        'price_cents', oi.price_cents_snapshot,
        'qty',         oi.qty,
        'notes',       oi.notes,
        'station',     oi.station::text
      )
    ),
    '[]'::jsonb
  )
  INTO v_items_json
  FROM public.order_items oi
  WHERE oi.order_id = p_order_id;

  -- ── 6. Obtener método de pago real desde payments ─────────────────────────
  SELECT COALESCE(p.provider, 'unknown')
  INTO v_payment_method
  FROM public.payments p
  WHERE p.order_id = p_order_id
  ORDER BY p.created_at DESC
  LIMIT 1;

  v_payment_method := COALESCE(v_payment_method, 'unknown');

  -- ── 7. Calcular puntos: floor(subtotal_cents / 10000) ────────────────────
  --      Ejemplos: $99→0, $100→1, $199→1, $200→2, $550→5.
  --      El delivery_fee NO genera puntos.
  v_points_earned := FLOOR(COALESCE(v_subtotal_cents, 0)::numeric / 10000)::int;

  -- ── 8. Insertar en customer_order_history (idempotente via UNIQUE) ────────
  INSERT INTO public.customer_order_history (
    original_order_id,
    customer_id,
    loyalty_account_id,
    order_number,
    order_date,
    type,
    customer_name,
    customer_phone,
    address_json,
    items_json,
    subtotal_cents,
    delivery_fee_cents,
    total_cents,
    payment_method,
    points_earned,
    paid_at
  ) VALUES (
    p_order_id,
    v_customer_id,
    v_loyalty_account_id,
    v_order_number,
    v_order_date,
    v_order_type,
    v_customer_name,
    v_customer_phone,
    v_address_json,
    v_items_json,
    COALESCE(v_subtotal_cents, 0),
    COALESCE(v_delivery_fee_cents, 0),
    COALESCE(v_total_cents, 0),
    v_payment_method,
    v_points_earned,
    v_paid_at
  )
  ON CONFLICT (original_order_id) DO NOTHING
  RETURNING id INTO v_history_id;

  -- Si ya existía el historial (ON CONFLICT DO NOTHING → sin RETURNING), recuperar su id.
  IF v_history_id IS NULL THEN
    SELECT id
    INTO v_history_id
    FROM public.customer_order_history
    WHERE original_order_id = p_order_id;
  END IF;

  -- ── 9. Crear entrada en loyalty_ledger (solo si points_earned > 0) ───────
  --      El índice UNIQUE idx_loyalty_ledger_earn_per_history garantiza
  --      que no pueda existir más de un 'earn' por order_history_id.
  IF v_points_earned > 0 THEN
    BEGIN
      INSERT INTO public.loyalty_ledger (
        loyalty_account_id,
        order_id,
        order_history_id,
        delta_points_int,
        type,
        note
      ) VALUES (
        v_loyalty_account_id,
        p_order_id,
        v_history_id,
        v_points_earned,
        'earn',
        'Puntos por compra #' || COALESCE(v_order_number::text, '?')
      );
      v_ledger_created := true;
    EXCEPTION
      WHEN unique_violation THEN
        -- El ledger ya existe para este historial → idempotente, no duplicar.
        v_ledger_created := false;
    END;

    -- ── 10. Incrementar points_int ÚNICAMENTE si se creó un nuevo ledger ───
    IF v_ledger_created THEN
      UPDATE public.loyalty_accounts
      SET points_int = points_int + v_points_earned,
          updated_at = now()
      WHERE id = v_loyalty_account_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok',             true,
    'history_id',     v_history_id,
    'points_earned',  v_points_earned,
    'ledger_created', v_ledger_created
  );
END;
$$;
