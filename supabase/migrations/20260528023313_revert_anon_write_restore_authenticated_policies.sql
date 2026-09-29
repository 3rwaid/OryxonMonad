/*
  # Revert anon write policies, restore authenticated-only write policies

  Removes the anon write policies added in the previous migration and
  restores proper authenticated-only write access for exchange_links,
  ido_phases, and ido_purchases.
*/

-- Drop anon write policies
DROP POLICY IF EXISTS "Anon can insert exchange links" ON exchange_links;
DROP POLICY IF EXISTS "Anon can update exchange links" ON exchange_links;
DROP POLICY IF EXISTS "Anon can delete exchange links" ON exchange_links;

DROP POLICY IF EXISTS "Anon can insert IDO phases" ON ido_phases;
DROP POLICY IF EXISTS "Anon can update IDO phases" ON ido_phases;
DROP POLICY IF EXISTS "Anon can delete IDO phases" ON ido_phases;

DROP POLICY IF EXISTS "Anon can insert IDO purchases" ON ido_purchases;
DROP POLICY IF EXISTS "Anon can read IDO purchases" ON ido_purchases;

-- Restore authenticated write for exchange_links
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_links' AND policyname = 'Authenticated users can insert exchange links') THEN
    CREATE POLICY "Authenticated users can insert exchange links"
      ON exchange_links FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_links' AND policyname = 'Authenticated users can update exchange links') THEN
    CREATE POLICY "Authenticated users can update exchange links"
      ON exchange_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'exchange_links' AND policyname = 'Authenticated users can delete exchange links') THEN
    CREATE POLICY "Authenticated users can delete exchange links"
      ON exchange_links FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- Restore authenticated write for ido_phases
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ido_phases' AND policyname = 'Authenticated users can insert IDO phases') THEN
    CREATE POLICY "Authenticated users can insert IDO phases"
      ON ido_phases FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ido_phases' AND policyname = 'Authenticated users can update IDO phases') THEN
    CREATE POLICY "Authenticated users can update IDO phases"
      ON ido_phases FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ido_phases' AND policyname = 'Authenticated users can delete IDO phases') THEN
    CREATE POLICY "Authenticated users can delete IDO phases"
      ON ido_phases FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ido_purchases: authenticated insert + read
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ido_purchases' AND policyname = 'Buyers can insert own purchase') THEN
    CREATE POLICY "Buyers can insert own purchase"
      ON ido_purchases FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ido_purchases' AND policyname = 'Buyers can read own purchases') THEN
    CREATE POLICY "Buyers can read own purchases"
      ON ido_purchases FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
