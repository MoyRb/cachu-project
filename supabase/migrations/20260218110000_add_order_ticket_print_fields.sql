ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS ticket_text text,
ADD COLUMN IF NOT EXISTS printed_customer_at timestamptz,
ADD COLUMN IF NOT EXISTS printed_packaging_at timestamptz;
