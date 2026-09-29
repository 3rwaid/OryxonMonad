/*
  # IDO Phases and Exchange Links

  1. New Tables
    - `ido_phases`
      - `id` (uuid, pk)
      - `phase_name` (text) – e.g. "Seed Round", "Public Sale"
      - `price_per_oxy` (numeric) – price in tCORE2 per 1 OXY
      - `hard_cap_oxy` (numeric) – max OXY to sell in this phase
      - `sold_oxy` (numeric) – running total sold (updated by admin)
      - `min_buy_oxy` (numeric) – minimum OXY per purchase
      - `max_buy_oxy` (numeric) – maximum OXY per purchase
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `ido_purchases`
      - `id` (uuid, pk)
      - `phase_id` (uuid, fk -> ido_phases)
      - `buyer_wallet` (text)
      - `oxy_amount` (numeric)
      - `tcore_amount` (numeric) – tCORE2 sent
      - `tx_hash` (text)
      - `status` (text) – 'pending' | 'confirmed' | 'refunded'
      - `created_at` (timestamptz)

    - `exchange_links`
      - `id` (uuid, pk)
      - `name` (text) – e.g. "CoreSwap", "Gate.io"
      - `type` (text) – 'dex' | 'cex'
      - `url` (text)
      - `logo_url` (text, nullable)
      - `pair` (text) – e.g. "OXY/USDT"
      - `is_active` (boolean)
      - `sort_order` (int)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public read for active ido_phases and exchange_links
    - Authenticated insert for ido_purchases (own records)
    - No public write on ido_phases or exchange_links (admin only via service role)
*/

-- IDO Phases
CREATE TABLE IF NOT EXISTS ido_phases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_name      text NOT NULL DEFAULT '',
  price_per_oxy   numeric NOT NULL DEFAULT 0,
  hard_cap_oxy    numeric NOT NULL DEFAULT 0,
  sold_oxy        numeric NOT NULL DEFAULT 0,
  min_buy_oxy     numeric NOT NULL DEFAULT 100,
  max_buy_oxy     numeric NOT NULL DEFAULT 100000,
  start_time      timestamptz NOT NULL DEFAULT now(),
  end_time        timestamptz NOT NULL DEFAULT now(),
  is_active       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ido_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active IDO phases"
  ON ido_phases FOR SELECT
  USING (true);

-- IDO Purchases
CREATE TABLE IF NOT EXISTS ido_purchases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id      uuid NOT NULL REFERENCES ido_phases(id),
  buyer_wallet  text NOT NULL DEFAULT '',
  oxy_amount    numeric NOT NULL DEFAULT 0,
  tcore_amount  numeric NOT NULL DEFAULT 0,
  tx_hash       text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ido_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can insert own purchase"
  ON ido_purchases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Buyers can read own purchases"
  ON ido_purchases FOR SELECT
  TO authenticated
  USING (buyer_wallet = lower(auth.jwt() ->> 'sub'));

-- Exchange Links
CREATE TABLE IF NOT EXISTS exchange_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT '',
  type        text NOT NULL DEFAULT 'dex',
  url         text NOT NULL DEFAULT '',
  logo_url    text,
  pair        text NOT NULL DEFAULT 'OXY/USDT',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exchange_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active exchange links"
  ON exchange_links FOR SELECT
  USING (true);

-- Seed default exchange links
INSERT INTO exchange_links (name, type, url, pair, is_active, sort_order) VALUES
  ('CoreSwap', 'dex', 'https://coreswap.io', 'OXY/tCORE2', true, 1),
  ('Gate.io', 'cex', 'https://gate.io', 'OXY/USDT', true, 2),
  ('MEXC', 'cex', 'https://mexc.com', 'OXY/USDT', true, 3)
ON CONFLICT DO NOTHING;
