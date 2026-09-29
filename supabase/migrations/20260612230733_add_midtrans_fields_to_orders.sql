ALTER TABLE tree_purchase_orders
  ADD COLUMN IF NOT EXISTS midtrans_order_id   text,
  ADD COLUMN IF NOT EXISTS midtrans_transaction_id text,
  ADD COLUMN IF NOT EXISTS currency            text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS total_price_idr     integer;

CREATE INDEX IF NOT EXISTS idx_orders_midtrans_order_id
  ON tree_purchase_orders (midtrans_order_id)
  WHERE midtrans_order_id IS NOT NULL;
