-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0008 — Realtime for the live roster
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- The faculty dashboard polled router.refresh() every 15 s to keep the
-- live roster current. This publishes attendance + sessions changes on
-- the `supabase_realtime` publication so the client can subscribe to
-- Postgres change events instead (see components/faculty/realtime-roster
-- .tsx). RLS still governs what a subscriber receives — staff read all
-- rows, so faculty get every roster insert/update for the open session.
--
-- Idempotent: adding a table already in the publication raises
-- `object already added`, so each ALTER is guarded.
-- ════════════════════════════════════════════════════════════════════

do $$
begin
  -- attendance: entries + exits appear on the roster in real time.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;

  -- sessions: so the roster reacts the instant a session is closed.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;
end $$;

-- REPLICA IDENTITY FULL so UPDATE/DELETE events carry the old row too —
-- exit-time updates and session closes then arrive with full context.
alter table public.attendance replica identity full;
alter table public.sessions   replica identity full;
