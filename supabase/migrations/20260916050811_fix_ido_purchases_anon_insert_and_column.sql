/*
  # Fix IDO Purchases: Allow Anon Insert + Add mon_amount Column

  1. Problem
     - The `ido_purchases` INSERT policy was scoped to `TO authenticated` only.
       IDO buyers connect a wallet but do NOT sign into Supabase, so they run as
       the `anon` role. Every insert silently failed RLS — purchases never recorded.
     - The frontend sends `mon_amount` but the table column is `tcore_amount`,
       causing a column mismatch on insert.

  2. Changes
     - Add `mon_amount` column to `ido_purchases` (nullable, defaults to 0).
       Keeps `tcore_amount` for backward compatibility.
     - Drop the `authenticated`-only INSERT policy and replace with one that
       allows `anon, authenticated` so wallet-only users can record purchases.
     - Drop the `authenticated`-only SELECT policy and replace with one that
       allows `anon, authenticated` so the frontend can query purchases by
       buyer_wallet without a Supabase session.

  3. Security Notes
     - `ido_purchases` rows are keyed by `buyer_wallet` (on-chain address), not
       by Supabase user_id. Anyone can insert, but that is the intended design:
       the actual token transfer happens on-chain; this table is a record of
       purchases. Admin verification happens via the admin panel.
     - `ido_phases` remains public read, authenticated write (admin only).
*/

-- Add mon_amount column
ALTER TABLE ido_purchases
  ADD COLUMN IF NOT EXISTS mon_amount numeric NOT NULL DEFAULT 0;

-- Replace INSERT policy: allow anon (wallet-only users)
DROP POLICY IF EXISTS "Buyers can insert own purchase" ON ido_purchases;
DROP POLICY IF EXISTS "Anon can insert IDO purchases" ON ido_purchases;
CREATE POLICY "Anyone can insert IDO purchases"
  ON ido_purchases FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Replace SELECT policy: allow anon to read (so buyers can see their own purchases by wallet)
DROP POLICY IF EXISTS "Buyers can read own purchases" ON ido_purchases;
DROP POLICY IF EXISTS "Anon can read IDO purchases" ON ido_purchases;
CREATE POLICY "Anyone can read IDO purchases"
  ON ido_purchases FOR SELECT
  TO anon, authenticated
  USING (true);
