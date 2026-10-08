-- Hardening: views pick up Supabase's default privileges (ALL for anon and
-- authenticated). service_price_timeline is read-only and security_invoker, so
-- the base table's grants and RLS already protect it; make its own grants
-- explicit as well: authenticated may only read it, anon nothing.
revoke all on public.service_price_timeline from anon, authenticated;
grant select on public.service_price_timeline to authenticated;
