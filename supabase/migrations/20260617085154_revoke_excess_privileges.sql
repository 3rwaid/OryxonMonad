-- ============================================================
-- Fix 1: Revoke EXECUTE on SECURITY DEFINER trigger function
--        from anon and authenticated roles.
--        It is only called internally by the trigger system —
--        it must never be callable by API clients.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;

-- ============================================================
-- Fix 2: Revoke excess DML privileges from anon on read-only
--        public tables.  anon only needs SELECT on these tables;
--        the default Supabase schema grant gives INSERT/UPDATE/
--        DELETE/TRUNCATE/TRIGGER as well, which is unnecessary.
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.app_settings
  FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.exchange_links
  FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.ido_phases
  FROM anon;

-- ============================================================
-- Fix 3: Revoke excess DML from authenticated on tables where
--        authenticated users must NOT write directly.
--        (Writes on these are performed via service-role edge
--        functions or explicitly-scoped admin policies only.)
-- ============================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.app_settings
  FROM authenticated;

-- exchange_links and ido_phases have admin-only INSERT/UPDATE/DELETE
-- policies (added in the previous security migration); revoke the
-- broad table-level DML grants so those policies are the sole gate.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.exchange_links
  FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.ido_phases
  FROM authenticated;

-- ============================================================
-- Fix 4: Revoke all excess privileges from anon on private
--        tables that buyers should never query directly.
--        (anon SELECT was already revoked in the previous
--        migration; this removes remaining DML noise.)
-- ============================================================
REVOKE UPDATE, DELETE, TRUNCATE, TRIGGER
  ON public.ido_purchases
  FROM anon;

REVOKE DELETE, TRUNCATE, TRIGGER
  ON public.tree_purchase_orders
  FROM anon;
