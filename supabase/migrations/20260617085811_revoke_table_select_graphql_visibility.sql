-- Revoke SELECT from anon and authenticated on tables whose schema
-- should not be visible in PostgREST/GraphQL.
-- Public reads now go through the get-public-data edge function (service role).
-- Admin reads for tree_purchase_orders go through get-admin-orders edge function.
-- Admin reads for ido_purchases go through get-admin-ido-purchases edge function.

REVOKE SELECT ON public.app_settings       FROM anon, authenticated;
REVOKE SELECT ON public.exchange_links     FROM anon, authenticated;
REVOKE SELECT ON public.ido_phases         FROM anon, authenticated;
REVOKE SELECT ON public.ido_purchases      FROM anon, authenticated;
REVOKE SELECT ON public.tree_purchase_orders FROM anon, authenticated;
