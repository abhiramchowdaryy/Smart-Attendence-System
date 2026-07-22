-- ════════════════════════════════════════════════════════════════════
-- Phase 3 · Migration 0006 — Login by register number
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- The PDF wants students to sign in with their PES register number
-- (e.g. PES1UG24CA119), not an email. Supabase Auth only knows emails,
-- so this SECURITY DEFINER function resolves a register number (stored in
-- profiles.roll_no) to the account email. It is callable before the user
-- is authenticated (anon), which is why it must be SECURITY DEFINER: an
-- anonymous visitor has no RLS access to profiles or auth.users.
--
-- Scope note: it returns ONLY the email for an exact roll_no match and
-- nothing else. That is the minimum needed to hand the pair to Supabase's
-- own password check — the password is still verified by Auth, never here.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.email_for_roll_no(p_roll text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.roll_no = upper(trim(p_roll))
  limit 1;
$$;

comment on function public.email_for_roll_no(text) is
  'Resolve a PES register number (profiles.roll_no) to its account email so the login form can accept register numbers. Password is still verified by Supabase Auth.';

-- Anonymous visitors call this from the login form before signing in.
grant execute on function public.email_for_roll_no(text) to anon, authenticated;
