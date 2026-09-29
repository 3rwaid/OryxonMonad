-- Grant table-level privileges to authenticated role for all tables
-- the admin page writes to directly from the browser.
-- Without these GRANTs, RLS policies alone cannot allow access.

-- exchange_links: admin manages exchange links (insert, update, delete, select)
GRANT SELECT, INSERT, UPDATE, DELETE ON exchange_links TO authenticated;

-- ido_phases: admin manages IDO phases (insert, update, delete, select)
GRANT SELECT, INSERT, UPDATE, DELETE ON ido_phases TO authenticated;

-- tree_purchase_orders: admin needs SELECT to read orders (already has INSERT/UPDATE/DELETE)
GRANT SELECT ON tree_purchase_orders TO authenticated;

-- ido_purchases: admin may need to read purchases
GRANT SELECT ON ido_purchases TO authenticated;
