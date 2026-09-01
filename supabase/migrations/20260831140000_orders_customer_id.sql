-- supabase/migrations/20260831140000_orders_customer_id.sql
--
-- CORTE 3: Vincular pedidos a clientes autenticados.
-- NO modifica create_order_with_items.
-- La columna se actualiza DESPUÉS de crear el pedido mediante UPDATE.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_id uuid NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON public.orders(customer_id);
