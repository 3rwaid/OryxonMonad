-- Grant table-level privileges to authenticated role so RLS policies can take effect.
-- Without these grants, even correct RLS policies won't allow access.
GRANT SELECT, INSERT, UPDATE ON app_settings TO authenticated;
