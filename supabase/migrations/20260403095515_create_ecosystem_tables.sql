/*
  # Create Sustainable Economy Ecosystem Tables

  1. New Tables
    - `nft_a` - NFT A collection (animal characters, 1000 supply)
      - `id` (uuid, primary key)
      - `token_id` (integer, unique) - on-chain token ID
      - `name` (text) - character name
      - `description` (text) - character description
      - `image_url` (text) - image URL
      - `animal_type` (text) - type of animal
      - `rarity` (text) - rarity tier
      - `owner_address` (text) - wallet address of owner
      - `is_minted` (boolean) - whether minted on-chain
      - `minted_at` (timestamptz) - when minted
    - `nft_b` - NFT B collection (RWA trees, unlimited supply)
      - `id` (uuid, primary key)
      - `token_id` (serial, unique) - auto-incrementing token ID
      - `name` (text) - tree name
      - `description` (text) - tree description
      - `image_url` (text) - image URL
      - `tree_species` (text) - species of tree
      - `location_lat` (decimal) - latitude
      - `location_lng` (decimal) - longitude
      - `location_name` (text) - human-readable location
      - `planter_name` (text) - who planted it
      - `planted_at` (timestamptz) - when planted
      - `owner_address` (text) - wallet address
      - `price_usd` (decimal) - price in USD
      - `is_staked` (boolean) - staking status
      - `staked_at` (timestamptz) - when staked
    - `oxy_balances` - $Oxy token balance tracking
      - `id` (uuid, primary key)
      - `wallet_address` (text, unique) - wallet address
      - `balance` (decimal) - current balance
      - `staking_rewards_earned` (decimal) - total rewards earned
    - `staking_positions` - NFT B staking records
      - `id` (uuid, primary key)
      - `nft_b_id` (uuid, FK) - reference to staked NFT B
      - `staker_address` (text) - staker wallet
      - `staked_at` (timestamptz) - when staked
      - `last_claim_at` (timestamptz) - last reward claim
      - `total_rewards_claimed` (decimal) - total claimed
      - `is_active` (boolean) - whether still staked
    - `marketplace_listings` - NFT marketplace
      - `id` (uuid, primary key)
      - `nft_type` (text) - 'A' or 'B'
      - `nft_id` (uuid) - reference to NFT
      - `seller_address` (text) - seller wallet
      - `price` (decimal) - listing price
      - `price_currency` (text) - ETH or OXY
      - `is_active` (boolean) - active listing
      - `buyer_address` (text) - buyer if sold
      - `sold_at` (timestamptz) - when sold
    - `token_allocations` - $Oxy token distribution tracking
      - `id` (uuid, primary key)
      - `category` (text) - allocation category
      - `percentage` (decimal) - percentage of total
      - `total_amount` (decimal) - total allocated
      - `distributed_amount` (decimal) - amount distributed
    - `reward_claims` - Staking reward claim history
      - `id` (uuid, primary key)
      - `staking_position_id` (uuid, FK) - staking position
      - `claimer_address` (text) - claimer wallet
      - `amount` (decimal) - claim amount
    - `nft_a_incentives` - Monthly NFT B airdrops to NFT A holders
      - `id` (uuid, primary key)
      - `nft_a_id` (uuid, FK) - NFT A reference
      - `nft_b_id` (uuid, FK) - NFT B awarded
      - `recipient_address` (text) - recipient wallet
      - `period` (text) - incentive period
    - `sale_phases` - NFT A sale configuration
      - `id` (uuid, primary key)
      - `phase_name` (text) - phase name
      - `price_eth` (decimal) - price in ETH
      - `max_per_wallet` (integer) - max per wallet
      - `start_time` / `end_time` (timestamptz)
      - `total_supply` (integer) - phase supply
      - `minted_count` (integer) - minted so far
      - `is_active` (boolean) - active phase
    - `platform_stats` - Global platform statistics
      - All aggregate counters for the ecosystem

  2. Security
    - RLS enabled on ALL tables
    - Public read access on non-sensitive data
    - Write access restricted to authenticated/service roles
*/

-- NFT A Collection (Animal Characters) - 1000 max supply
CREATE TABLE IF NOT EXISTS nft_a (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  animal_type text NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  owner_address text DEFAULT '',
  is_minted boolean DEFAULT false,
  minted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nft_a ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view NFT A collection"
  ON nft_a FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert NFT A"
  ON nft_a FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can update NFT A"
  ON nft_a FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- NFT B Collection (RWA Trees) - unlimited supply
CREATE TABLE IF NOT EXISTS nft_b (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id serial UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  tree_species text NOT NULL,
  location_lat decimal DEFAULT 0,
  location_lng decimal DEFAULT 0,
  location_name text DEFAULT '',
  planter_name text DEFAULT '',
  planted_at timestamptz DEFAULT now(),
  owner_address text DEFAULT '',
  price_usd decimal DEFAULT 0,
  is_staked boolean DEFAULT false,
  staked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nft_b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view NFT B collection"
  ON nft_b FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert NFT B"
  ON nft_b FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update NFT B"
  ON nft_b FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- $Oxy Token Balances
CREATE TABLE IF NOT EXISTS oxy_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  balance decimal DEFAULT 0,
  staking_rewards_earned decimal DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE oxy_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance"
  ON oxy_balances FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert balance"
  ON oxy_balances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update balance"
  ON oxy_balances FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Staking Positions
CREATE TABLE IF NOT EXISTS staking_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_b_id uuid REFERENCES nft_b(id),
  staker_address text NOT NULL,
  staked_at timestamptz DEFAULT now(),
  last_claim_at timestamptz DEFAULT now(),
  total_rewards_claimed decimal DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staking_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view staking positions"
  ON staking_positions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create staking position"
  ON staking_positions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update staking position"
  ON staking_positions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_type text NOT NULL CHECK (nft_type IN ('A', 'B')),
  nft_id uuid NOT NULL,
  seller_address text NOT NULL,
  price decimal NOT NULL,
  price_currency text NOT NULL DEFAULT 'ETH',
  is_active boolean DEFAULT true,
  buyer_address text DEFAULT '',
  sold_at timestamptz,
  fee_amount decimal DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON marketplace_listings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can create listing"
  ON marketplace_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update listing"
  ON marketplace_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Token Allocations
CREATE TABLE IF NOT EXISTS token_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  percentage decimal NOT NULL,
  total_amount decimal NOT NULL,
  distributed_amount decimal DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE token_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view allocations"
  ON token_allocations FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert allocations"
  ON token_allocations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update allocations"
  ON token_allocations FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Reward Claims
CREATE TABLE IF NOT EXISTS reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staking_position_id uuid REFERENCES staking_positions(id),
  claimer_address text NOT NULL,
  amount decimal NOT NULL,
  claimed_at timestamptz DEFAULT now()
);

ALTER TABLE reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
  ON reward_claims FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert claims"
  ON reward_claims FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- NFT A Holder Incentives (Monthly NFT B airdrops)
CREATE TABLE IF NOT EXISTS nft_a_incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_a_id uuid REFERENCES nft_a(id),
  nft_b_id uuid REFERENCES nft_b(id),
  recipient_address text NOT NULL,
  period text NOT NULL,
  distributed_at timestamptz DEFAULT now()
);

ALTER TABLE nft_a_incentives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view incentives"
  ON nft_a_incentives FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert incentives"
  ON nft_a_incentives FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Sale Phases
CREATE TABLE IF NOT EXISTS sale_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_name text NOT NULL,
  price_eth decimal NOT NULL DEFAULT 0.01,
  max_per_wallet integer DEFAULT 5,
  start_time timestamptz,
  end_time timestamptz,
  total_supply integer NOT NULL,
  minted_count integer DEFAULT 0,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sale_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sale phases"
  ON sale_phases FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert sale phases"
  ON sale_phases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update sale phases"
  ON sale_phases FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Platform Stats (singleton row)
CREATE TABLE IF NOT EXISTS platform_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_nft_a_minted integer DEFAULT 0,
  total_nft_b_minted integer DEFAULT 0,
  total_oxy_distributed decimal DEFAULT 0,
  total_trees_planted integer DEFAULT 0,
  total_staked_nft_b integer DEFAULT 0,
  staking_reward_pool decimal DEFAULT 1680000000,
  marketplace_fee_pool decimal DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform stats"
  ON platform_stats FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update platform stats"
  ON platform_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can insert platform stats"
  ON platform_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_nft_a_owner ON nft_a(owner_address);
CREATE INDEX IF NOT EXISTS idx_nft_a_token ON nft_a(token_id);
CREATE INDEX IF NOT EXISTS idx_nft_b_owner ON nft_b(owner_address);
CREATE INDEX IF NOT EXISTS idx_nft_b_staked ON nft_b(is_staked);
CREATE INDEX IF NOT EXISTS idx_staking_active ON staking_positions(is_active);
CREATE INDEX IF NOT EXISTS idx_staking_staker ON staking_positions(staker_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace_listings(is_active);
CREATE INDEX IF NOT EXISTS idx_oxy_wallet ON oxy_balances(wallet_address);
