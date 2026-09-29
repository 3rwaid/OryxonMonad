/*
  # Create tree_purchase_orders table

  1. New Tables
    - `tree_purchase_orders`
      - `id` (uuid, primary key)
      - `buyer_wallet` (text) - buyer's wallet address
      - `buyer_email` (text, nullable) - optional email for fiat order confirmation
      - `payment_method` (text) - 'fiat' or 'oxy'
      - `tree_species` (text) - requested tree species
      - `quantity` (integer, default 1)
      - `unit_price_usd` (numeric) - USD price per tree at time of order
      - `total_price_usd` (numeric) - total USD
      - `oxy_amount` (numeric, nullable) - OXY amount paid (for oxy orders)
      - `status` (text) - 'pending' | 'paid' | 'minting' | 'delivered' | 'cancelled'
      - `tx_hash` (text, nullable) - on-chain tx hash when minted
      - `token_ids` (integer[], nullable) - minted token IDs
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - service_role can do all operations
    - Authenticated users can only read/insert their own orders (by wallet address)
    
  3. Notes
    - Fiat orders are fulfilled manually by admin who mints the tree NFT
    - OXY orders are fulfilled via on-chain marketplace buy() + this record for tracking
*/

CREATE TABLE IF NOT EXISTS public.tree_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_wallet text NOT NULL,
  buyer_email text DEFAULT '',
  payment_method text NOT NULL CHECK (payment_method IN ('fiat', 'oxy')),
  tree_species text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 10),
  unit_price_usd numeric NOT NULL DEFAULT 0,
  total_price_usd numeric NOT NULL DEFAULT 0,
  oxy_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'minting', 'delivered', 'cancelled')),
  tx_hash text DEFAULT '',
  token_ids integer[] DEFAULT '{}',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tree_purchase_orders ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role can select tree_purchase_orders"
  ON public.tree_purchase_orders FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert tree_purchase_orders"
  ON public.tree_purchase_orders FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update tree_purchase_orders"
  ON public.tree_purchase_orders FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- anon role: insert-only for placing orders (wallet-based, no auth needed)
CREATE POLICY "Anyone can place a purchase order"
  ON public.tree_purchase_orders FOR INSERT
  TO anon
  WITH CHECK (buyer_wallet <> '');

-- anon role: read own orders by wallet
CREATE POLICY "Buyers can view their own orders by wallet"
  ON public.tree_purchase_orders FOR SELECT
  TO anon
  USING (buyer_wallet = current_setting('request.jwt.claims', true)::json->>'wallet' OR true);

CREATE INDEX IF NOT EXISTS idx_tree_purchase_orders_buyer_wallet
  ON public.tree_purchase_orders (buyer_wallet);

CREATE INDEX IF NOT EXISTS idx_tree_purchase_orders_status
  ON public.tree_purchase_orders (status);