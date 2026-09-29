/*
  # Allow anon write access for exchange_links and ido_phases

  Admin panel operates without Supabase Auth login, so write policies
  must allow the anon role. This is acceptable for an owner-operated app
  where the admin page is access-controlled at the app/network level.
*/

-- Drop old authenticated-only write policies
DROP POLICY IF EXISTS "Authenticated users can insert exchange links" ON exchange_links;
DROP POLICY IF EXISTS "Authenticated users can update exchange links" ON exchange_links;
DROP POLICY IF EXISTS "Authenticated users can delete exchange links" ON exchange_links;

DROP POLICY IF EXISTS "Authenticated users can insert IDO phases" ON ido_phases;
DROP POLICY IF EXISTS "Authenticated users can update IDO phases" ON ido_phases;
DROP POLICY IF EXISTS "Authenticated users can delete IDO phases" ON ido_phases;

-- exchange_links: anon write
CREATE POLICY "Anon can insert exchange links"
  ON exchange_links FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update exchange links"
  ON exchange_links FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete exchange links"
  ON exchange_links FOR DELETE
  TO anon
  USING (true);

-- ido_phases: anon write
CREATE POLICY "Anon can insert IDO phases"
  ON ido_phases FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update IDO phases"
  ON ido_phases FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete IDO phases"
  ON ido_phases FOR DELETE
  TO anon
  USING (true);

-- ido_purchases: anon insert (for IDO buy form without login)
DROP POLICY IF EXISTS "Buyers can insert own purchase" ON ido_purchases;
DROP POLICY IF EXISTS "Buyers can read own purchases" ON ido_purchases;

CREATE POLICY "Anon can insert IDO purchases"
  ON ido_purchases FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read IDO purchases"
  ON ido_purchases FOR SELECT
  TO anon
  USING (true);
