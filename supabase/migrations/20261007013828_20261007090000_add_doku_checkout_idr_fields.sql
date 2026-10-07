/*
# Add DOKU Checkout and IDR order fields

1. Purpose
- Replace the active fiat-payment data path from Midtrans-specific fields to DOKU Checkout.
- Store all new fiat pricing in Indonesian rupiah (IDR), matching DOKU's required currency format.

2. New columns on `public.tree_purchase_orders`
- `unit_price_idr` (numeric) - IDR price per OxyTree captured when the order is created.
- `doku_invoice_number` (text) - unique merchant invoice sent to DOKU.
- `doku_payment_url` (text) - DOKU Checkout URL returned for the buyer.
- `doku_transaction_id` (text) - DOKU transaction identifier when supplied by a notification.

3. Modified columns/settings
- `currency` now defaults to `IDR` for new orders.
- Add the public `tree_price_idr` setting with a 400000 IDR default for existing installations. Existing USD columns and historical values are preserved.

4. Security
- No new public access is granted.
- Existing RLS policies remain unchanged.

5. Important notes
- Existing order records are not deleted or rewritten.
- The application will use the new IDR and DOKU fields for all new fiat checkout orders.
*/

ALTER TABLE public.tree_purchase_orders
  ADD COLUMN IF NOT EXISTS unit_price_idr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS doku_invoice_number text,
  ADD COLUMN IF NOT EXISTS doku_payment_url text,
  ADD COLUMN IF NOT EXISTS doku_transaction_id text;

ALTER TABLE public.tree_purchase_orders
  ALTER COLUMN currency SET DEFAULT 'IDR';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tree_purchase_orders_doku_invoice_number
  ON public.tree_purchase_orders (doku_invoice_number)
  WHERE doku_invoice_number IS NOT NULL;

INSERT INTO public.app_settings (key, value, label)
VALUES ('tree_price_idr', '400000', 'NFT Tree Price (IDR)')
ON CONFLICT (key) DO NOTHING;