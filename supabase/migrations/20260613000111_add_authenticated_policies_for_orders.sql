-- Allow authenticated users (admins logged in via Supabase auth) to read all orders
CREATE POLICY "Authenticated users can select all tree_purchase_orders"
  ON public.tree_purchase_orders FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update orders (for admin status changes)
CREATE POLICY "Authenticated users can update tree_purchase_orders"
  ON public.tree_purchase_orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
