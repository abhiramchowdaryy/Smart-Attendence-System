-- ════════════════════════════════════════════════════════════════════
-- Phase 3 · Migration 0010 — Richer attendance verification fields
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- The PDF's "Attendance detail stored" list wants Late Entry (Yes/No),
-- Early Exit (Yes/No), GPS/Wi-Fi Verification Status and Face Verification
-- Status kept explicitly — not just inferred from the coarse status enum.
-- We add them as booleans plus `verified_via` ('gps' | 'network') so the
-- college-Wi-Fi fallback (weak GPS but on the campus network) is auditable.
-- ════════════════════════════════════════════════════════════════════

alter table public.attendance
  add column if not exists late_entry    boolean not null default false,
  add column if not exists early_exit    boolean not null default false,
  add column if not exists gps_verified  boolean not null default false,
  add column if not exists face_verified boolean not null default false,
  add column if not exists verified_via  text
    check (verified_via is null or verified_via in ('gps', 'network'));

-- Admin-managed allow-list of campus network IP prefixes. When GPS is weak
-- but the request comes from one of these (i.e. the college Wi-Fi's public
-- egress IP), attendance can still be verified. Empty = fallback disabled.
alter table public.gps_settings
  add column if not exists wifi_networks text[] not null default '{}';
