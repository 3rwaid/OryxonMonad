/*
  # Add write policies for exchange_links and ido_phases

  Both tables currently only have public SELECT policies.
  This migration adds INSERT, UPDATE, DELETE policies for authenticated users,
  so the admin panel can manage these tables.

  Note: In production, these should be restricted to admin role only.
  For now, any authenticated user can write (suitable for owner-operated apps).
*/

-- exchange_links: authenticated write
CREATE POLICY "Authenticated users can insert exchange links"
  ON exchange_links FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update exchange links"
  ON exchange_links FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete exchange links"
  ON exchange_links FOR DELETE
  TO authenticated
  USING (true);

-- ido_phases: authenticated write
CREATE POLICY "Authenticated users can insert IDO phases"
  ON ido_phases FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update IDO phases"
  ON ido_phases FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete IDO phases"
  ON ido_phases FOR DELETE
  TO authenticated
  USING (true);
