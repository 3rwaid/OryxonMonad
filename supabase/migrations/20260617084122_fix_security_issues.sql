-- ============================================================
-- Security fixes
-- ============================================================

-- 1. Fix function search_path (mutable search_path vulnerability)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. exchange_links write policies: restrict to admin only
--    (previously USING/WITH CHECK = true for all authenticated)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert exchange links" ON public.exchange_links;
DROP POLICY IF EXISTS "Authenticated users can update exchange links" ON public.exchange_links;
DROP POLICY IF EXISTS "Authenticated users can delete exchange links" ON public.exchange_links;

CREATE POLICY "Admin can insert exchange links"
  ON public.exchange_links FOR INSERT
  TO authenticated
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

CREATE POLICY "Admin can update exchange links"
  ON public.exchange_links FOR UPDATE
  TO authenticated
  USING  (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true)
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

CREATE POLICY "Admin can delete exchange links"
  ON public.exchange_links FOR DELETE
  TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

-- ============================================================
-- 3. ido_phases write policies: restrict to admin only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert IDO phases" ON public.ido_phases;
DROP POLICY IF EXISTS "Authenticated users can update IDO phases" ON public.ido_phases;
DROP POLICY IF EXISTS "Authenticated users can delete IDO phases" ON public.ido_phases;

CREATE POLICY "Admin can insert IDO phases"
  ON public.ido_phases FOR INSERT
  TO authenticated
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

CREATE POLICY "Admin can update IDO phases"
  ON public.ido_phases FOR UPDATE
  TO authenticated
  USING  (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true)
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

CREATE POLICY "Admin can delete IDO phases"
  ON public.ido_phases FOR DELETE
  TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

-- ============================================================
-- 4. ido_purchases: fix INSERT always-true + scoped SELECT
-- ============================================================
DROP POLICY IF EXISTS "Buyers can insert own purchase" ON public.ido_purchases;
CREATE POLICY "Buyers can insert own purchase"
  ON public.ido_purchases FOR INSERT
  TO authenticated
  WITH CHECK (buyer_wallet <> '' AND length(buyer_wallet) >= 10);

-- Scope SELECT to admin only (only admin views purchases in this app)
DROP POLICY IF EXISTS "Buyers can read own purchases" ON public.ido_purchases;
CREATE POLICY "Admin can read all IDO purchases"
  ON public.ido_purchases FOR SELECT
  TO authenticated
  USING (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

-- ============================================================
-- 5. tree_purchase_orders: fix broken SELECT + UPDATE policies
-- ============================================================

-- Drop the broken anon SELECT policy that has "OR true" (always leaks all orders)
DROP POLICY IF EXISTS "Buyers can view their own orders by wallet" ON public.tree_purchase_orders;

-- Fix the always-true authenticated UPDATE policy to admin only
DROP POLICY IF EXISTS "Authenticated users can update tree_purchase_orders" ON public.tree_purchase_orders;
CREATE POLICY "Admin can update tree_purchase_orders"
  ON public.tree_purchase_orders FOR UPDATE
  TO authenticated
  USING  (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true)
  WITH CHECK (coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) = true);

-- ============================================================
-- 6. Revoke excess privileges from anon on private tables
--    ido_purchases: no anon access needed at all
--    tree_purchase_orders: anon still needs INSERT + UPDATE (buyer flow)
--                          but not SELECT (RLS USING on UPDATE works without SELECT grant)
-- ============================================================
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ido_purchases FROM anon;
REVOKE SELECT ON public.tree_purchase_orders FROM anon;
