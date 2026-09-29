/*
# Fix app_settings write permissions for admin users

## Problem
The app_settings table only allowed the service_role to INSERT and UPDATE.
When an admin user tried to save settings (like the OXY payment wallet address)
from the browser, they got "permission denied for table app_settings" because
the browser client uses the authenticated role, not the service_role.

## Changes
- Adds INSERT and UPDATE policies for authenticated users whose JWT contains
  either is_admin=true OR role='superadmin' OR role='admin'.
- Keeps the existing service_role policies.
- Keeps the existing public SELECT policy (anyone can read settings).

## Security
- Only admin/superadmin users can write to app_settings.
- Regular users and anonymous users can still read but not write.
*/

-- Drop old service-role-only policies (they will be re-created alongside admin policies)
DROP POLICY IF EXISTS "Service role can insert app_settings" ON app_settings;
DROP POLICY IF EXISTS "Service role can update app_settings" ON app_settings;

-- Allow admin/superadmin to INSERT
CREATE POLICY "admin_can_insert_app_settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'is_admin'::text)::boolean, false) = true
    OR
    auth.jwt() -> 'app_metadata'::text ->> 'role'::text IN ('superadmin', 'admin')
  );

-- Allow admin/superadmin to UPDATE
CREATE POLICY "admin_can_update_app_settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'is_admin'::text)::boolean, false) = true
    OR
    auth.jwt() -> 'app_metadata'::text ->> 'role'::text IN ('superadmin', 'admin')
  )
  WITH CHECK (
    COALESCE(((auth.jwt() -> 'app_metadata'::text) ->> 'is_admin'::text)::boolean, false) = true
    OR
    auth.jwt() -> 'app_metadata'::text ->> 'role'::text IN ('superadmin', 'admin')
  );

-- Keep service_role policies for edge functions
CREATE POLICY "service_role_can_insert_app_settings"
  ON app_settings FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_can_update_app_settings"
  ON app_settings FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
