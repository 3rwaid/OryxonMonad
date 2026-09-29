/*
  # App Settings table + fix order policies

  1. New Tables
    - `app_settings`
      - `key` (text, primary key) - setting key
      - `value` (text) - setting value as text (cast as needed)
      - `label` (text) - human-readable label for admin UI
      - `updated_at` (timestamptz)

  2. Seed default settings
    - tree_price_usd: 25
    - tree_price_oxy: 500
    - admin_wallet: '' (to be filled by admin)
    - oxy_receiver_wallet: '' (wallet that receives OXY payments)
    - max_order_quantity: 10

  3. Fix tree_purchase_orders policies
    - Allow anon to SELECT their own orders by buyer_wallet param
    - Allow anon to UPDATE status/tx_hash (for completing OXY payment flow)

  4. Security
    - RLS enabled on app_settings
    - Anyone can read settings (prices are public)
    - Only service_role can write settings
*/

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can update app_settings"
  ON public.app_settings FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can insert app_settings"
  ON public.app_settings FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Seed default settings
INSERT INTO public.app_settings (key, value, label) VALUES
  ('tree_price_usd',      '25',   'NFT Tree Price (USD)'),
  ('tree_price_oxy',      '500',  'NFT Tree Price (OXY)'),
  ('oxy_receiver_wallet', '',     'OXY Payment Receiver Wallet'),
  ('max_order_quantity',  '10',   'Max Trees Per Order')
ON CONFLICT (key) DO NOTHING;

-- Fix orders: allow anon to UPDATE their own order (to record tx_hash after OXY transfer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tree_purchase_orders'
    AND policyname = 'Buyers can update their own pending orders'
  ) THEN
    CREATE POLICY "Buyers can update their own pending orders"
      ON public.tree_purchase_orders FOR UPDATE
      TO anon
      USING (status IN ('pending'))
      WITH CHECK (buyer_wallet <> '');
  END IF;
END $$;

-- Add missing updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_tree_purchase_orders_updated_at'
  ) THEN
    CREATE TRIGGER set_tree_purchase_orders_updated_at
      BEFORE UPDATE ON public.tree_purchase_orders
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;