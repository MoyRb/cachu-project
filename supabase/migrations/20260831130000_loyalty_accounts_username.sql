-- supabase/migrations/20260831130000_loyalty_accounts_username.sql
--
-- CORTE 2: Permite que loyalty_accounts soporte clientes sin teléfono
-- y agrega campo username para identificación.
-- NO modifica migraciones anteriores.

-- phone ya no es obligatorio: clientes se registran solo con username/password.
ALTER TABLE public.loyalty_accounts
  ALTER COLUMN phone DROP NOT NULL;

-- username: identificador legible y único del cliente.
ALTER TABLE public.loyalty_accounts
  ADD COLUMN IF NOT EXISTS username text;

-- Índice único parcial: no duplicar usernames, pero permite NULL (cuentas legacy sin usuario).
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_accounts_username
  ON public.loyalty_accounts(username)
  WHERE username IS NOT NULL;
