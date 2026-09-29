/*
  # OxyEco Sustainable Economy - Core Schema

  1. New Tables
    - `nft_a_collection` - Premium animal character NFTs (1000 max supply)
      - `id` (uuid, primary key)
      - `token_id` (integer, unique) - on-chain token ID
      - `name` (text) - character name
      - `description` (text) - character description
      - `image_url` (text) - character image
      - `rarity` (text) - common/rare/epic/legendary
      - `owner_wallet` (text) - current owner wallet address
      - `mint_price_eth` (numeric) - mint price in ETH
      - `is_minted` (boolean) - whether it has been minted
      - `minted_at` (timestamptz) - when it was minted
      - `created_at` (timestamptz)

    - `nft_b_collection` - RWA Tree NFTs (unlimited supply)
      - `id` (uuid, primary key)
      - `token_id` (integer, unique) - on-chain token ID
      - `tree_species` (text) - species of tree
      - `tree_location` (text) - planting location
      - `planter_name` (text) - who planted it
      - `planting_date` (date) - when planted
      - `image_url` (text) - tree photo
      - `owner_wallet` (text) - current owner
      - `mint_price_usd` (numeric) - price in USD
      - `is_staked` (boolean) - whether currently staked
      - `staked_at` (timestamptz) - when staked
      - `carbon_offset_kg` (numeric) - estimated CO2 offset
      - `created_at` (timestamptz)

    - `oxy_token_info` - $Oxy token metadata and supply tracking
      - `id` (uuid, primary key)
      - `total_supply` (numeric) - current total supply
      - `max_supply` (numeric) - 2.1 billion max
      - `circulating_supply` (numeric)
      - `staking_pool_remaining` (numeric) - remaining in staking pool
      - `ido_allocation` (numeric) - IDO allocation
      - `liquidity_allocation` (numeric) - liquidity allocation
      - `staking_allocation` (numeric) - staking rewards allocation
      - `updated_at` (timestamptz)

    - `staking_positions` - NFT B staking records
      - `id` (uuid, primary key)
      - `nft_b_id` (uuid, FK) - reference to NFT B
      - `owner_wallet` (text) - staker wallet
      - `staked_at` (timestamptz) - stake start time
      - `last_claimed_at` (timestamptz) - last reward claim
      - `total_rewards_claimed` (numeric) - total $Oxy claimed
      - `is_active` (boolean) - currently staked

    - `marketplace_listings` - NFT marketplace
      - `id` (uuid, primary key)
      - `nft_type` (text) - 'A' or 'B'
      - `nft_id` (uuid) - reference to NFT
      - `seller_wallet` (text)
      - `price_oxy` (numeric) - price in $Oxy
      - `price_eth` (numeric) - price in ETH
      - `is_active` (boolean)
      - `buyer_wallet` (text) - buyer if sold
      - `sold_at` (timestamptz)
      - `platform_fee_oxy` (numeric) - fee collected
      - `created_at` (timestamptz)

    - `ecosystem_stats` - Aggregated ecosystem statistics
      - `id` (uuid, primary key)
      - `total_trees_planted` (integer)
      - `total_carbon_offset_kg` (numeric)
      - `total_nft_a_minted` (integer)
      - `total_nft_b_minted` (integer)
      - `total_oxy_distributed` (numeric)
      - `total_stakers` (integer)
      - `marketplace_volume_oxy` (numeric)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public read access for collection/stats data
    - Write restricted to service role / edge functions
*/

CREATE TABLE IF NOT EXISTS nft_a_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  owner_wallet text,
  mint_price_eth numeric NOT NULL DEFAULT 0.01,
  is_minted boolean DEFAULT false,
  minted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nft_a_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view NFT A collection"
  ON nft_a_collection FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view NFT A collection"
  ON nft_a_collection FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS nft_b_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id serial UNIQUE,
  tree_species text NOT NULL,
  tree_location text NOT NULL,
  planter_name text DEFAULT '',
  planting_date date DEFAULT CURRENT_DATE,
  image_url text DEFAULT '',
  owner_wallet text,
  mint_price_usd numeric NOT NULL DEFAULT 25.00,
  is_staked boolean DEFAULT false,
  staked_at timestamptz,
  carbon_offset_kg numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE nft_b_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view NFT B collection"
  ON nft_b_collection FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view NFT B collection"
  ON nft_b_collection FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS oxy_token_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_supply numeric NOT NULL DEFAULT 0,
  max_supply numeric NOT NULL DEFAULT 2100000000,
  circulating_supply numeric NOT NULL DEFAULT 0,
  staking_pool_remaining numeric NOT NULL DEFAULT 1680000000,
  ido_allocation numeric NOT NULL DEFAULT 210000000,
  liquidity_allocation numeric NOT NULL DEFAULT 210000000,
  staking_allocation numeric NOT NULL DEFAULT 1680000000,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE oxy_token_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view token info"
  ON oxy_token_info FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view token info"
  ON oxy_token_info FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS staking_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_b_id uuid NOT NULL REFERENCES nft_b_collection(id),
  owner_wallet text NOT NULL,
  staked_at timestamptz DEFAULT now(),
  last_claimed_at timestamptz DEFAULT now(),
  total_rewards_claimed numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staking_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view staking positions"
  ON staking_positions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view staking positions"
  ON staking_positions FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nft_type text NOT NULL CHECK (nft_type IN ('A', 'B')),
  nft_id uuid NOT NULL,
  seller_wallet text NOT NULL,
  price_oxy numeric DEFAULT 0,
  price_eth numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  buyer_wallet text,
  sold_at timestamptz,
  platform_fee_oxy numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view marketplace listings"
  ON marketplace_listings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view marketplace listings"
  ON marketplace_listings FOR SELECT
  TO anon
  USING (true);

CREATE TABLE IF NOT EXISTS ecosystem_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_trees_planted integer DEFAULT 0,
  total_carbon_offset_kg numeric DEFAULT 0,
  total_nft_a_minted integer DEFAULT 0,
  total_nft_b_minted integer DEFAULT 0,
  total_oxy_distributed numeric DEFAULT 0,
  total_stakers integer DEFAULT 0,
  marketplace_volume_oxy numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ecosystem_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ecosystem stats"
  ON ecosystem_stats FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Public can view ecosystem stats"
  ON ecosystem_stats FOR SELECT
  TO anon
  USING (true);

INSERT INTO oxy_token_info (total_supply, max_supply, circulating_supply, staking_pool_remaining, ido_allocation, liquidity_allocation, staking_allocation)
VALUES (0, 2100000000, 0, 1680000000, 210000000, 210000000, 1680000000);

INSERT INTO ecosystem_stats (total_trees_planted, total_carbon_offset_kg, total_nft_a_minted, total_nft_b_minted, total_oxy_distributed, total_stakers, marketplace_volume_oxy)
VALUES (0, 0, 0, 0, 0, 0, 0);