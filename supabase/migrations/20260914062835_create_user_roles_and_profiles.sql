/*
# Create user_roles table and profiles for role-based authentication

## Summary
Adds role-based authentication with three roles: superadmin, admin, and end_user.
Replaces the single is_admin boolean with a structured role system.

## New Tables
- `user_roles`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, ON DELETE CASCADE)
  - `role` (text, CHECK constraint: 'superadmin' | 'admin' | 'end_user')
  - `assigned_by` (uuid, references auth.users, nullable — who granted the role)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on user_roles.
- Users can READ their own role row.
- superadmin and admin can READ all roles (for the admin panel user management).
- Only superadmin can INSERT/UPDATE/DELETE role rows (promote/demote users).
- No one can modify their own role (prevent privilege escalation).

## Important Notes
1. The first superadmin is seeded via the set-admin-claim edge function using
   the ADMIN_EMAIL env var. When that function runs, it also creates a
   user_roles row with role='superadmin' for the matching user.
2. New sign-ups get role='end_user' by default via a trigger.
3. The role is stored in auth.users.app_metadata.role as a JWT claim for
   fast client-side checks, and in user_roles for server-side enforcement.
*/

-- ── user_roles table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'end_user'
              CHECK (role IN ('superadmin', 'admin', 'end_user')),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
DROP POLICY IF EXISTS "select_own_role" ON user_roles;
CREATE POLICY "select_own_role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Superadmin and admin can read all roles (for user management UI)
DROP POLICY IF EXISTS "select_all_roles_admin" ON user_roles;
CREATE POLICY "select_all_roles_admin"
  ON user_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('superadmin', 'admin')
    )
  );

-- Only superadmin can insert role rows (assign roles to others)
DROP POLICY IF EXISTS "insert_roles_superadmin" ON user_roles;
CREATE POLICY "insert_roles_superadmin"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'superadmin'
    )
  );

-- Only superadmin can update role rows (promote/demote)
DROP POLICY IF EXISTS "update_roles_superadmin" ON user_roles;
CREATE POLICY "update_roles_superadmin"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'superadmin'
    )
  );

-- Only superadmin can delete role rows
DROP POLICY IF EXISTS "delete_roles_superadmin" ON user_roles;
CREATE POLICY "delete_roles_superadmin"
  ON user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'superadmin'
    )
  );

-- ── Trigger: assign end_user role to new sign-ups ─────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'end_user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ── Helper function: get current user's role ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = auth.uid()),
    'end_user'
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_role() TO authenticated;