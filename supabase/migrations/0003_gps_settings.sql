-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0003 — GPS / geofence policy settings
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- A single-row table holding the institution-wide GPS policy that used to
-- be hardcoded in the mark-attendance server action and geofence hook:
--   • accuracy_grace_m — metres of GPS-drift tolerance beyond the radius
--   • late_after_min   — minutes after session open before an entry is Late
--   • high_accuracy    — request high-accuracy geolocation on the client
-- The `id boolean primary key default true check (id)` trick pins the
-- table to exactly one row.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.gps_settings (
  id              boolean primary key default true check (id),
  accuracy_grace_m int not null default 25 check (accuracy_grace_m between 0 and 500),
  late_after_min   int not null default 10 check (late_after_min between 0 and 240),
  high_accuracy    boolean not null default true,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id)
);

-- Ensure the single settings row exists with defaults.
insert into public.gps_settings (id) values (true) on conflict (id) do nothing;

alter table public.gps_settings enable row level security;

-- Everyone signed-in reads the policy (the mark flow needs it); admin writes.
create policy "gps_settings: read for authenticated"
  on public.gps_settings for select
  using (auth.uid() is not null);

create policy "gps_settings: admin writes"
  on public.gps_settings for all
  using (public.current_user_role() = 'admin');
