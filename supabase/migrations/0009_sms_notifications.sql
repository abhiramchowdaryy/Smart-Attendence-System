-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0009 — Parent SMS notification log
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- Backs the Twilio parent-SMS feature (supabase/functions/notify-shortfall).
-- One row per attempted message, so staff can see who was notified, when,
-- and whether Twilio accepted it. The edge function writes rows with the
-- service-role key (bypassing RLS); these policies govern who can READ the
-- history in the app and let staff record entries directly if needed.
--
-- The SMS target is profiles.parent_phone (added in schema.sql). This log
-- stores the number actually dialled (normalised E.164) for auditability.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.sms_notifications (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  parent_phone  text not null,                 -- normalised E.164 actually dialled
  course_code   text references public.courses (code),
  official_pct  numeric(5, 2),                 -- shortfall context at send time
  message       text not null,
  -- queued  : accepted by our code, not yet sent (e.g. Twilio not configured)
  -- sent    : Twilio accepted the message
  -- failed  : Twilio (or validation) rejected it
  status        text not null default 'queued'
                  check (status in ('queued', 'sent', 'failed')),
  provider_sid  text,                           -- Twilio message SID when sent
  error         text,                           -- failure reason when failed
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

create index if not exists sms_notifications_student_idx
  on public.sms_notifications (student_id, created_at desc);

alter table public.sms_notifications enable row level security;

-- Read: the student themselves (so the parent view can show it) or staff.
create policy "sms_notifications: read own or staff"
  on public.sms_notifications for select
  using (
    student_id = auth.uid()
    or public.current_user_role() in ('faculty', 'admin')
  );

-- Direct writes are staff-only; the edge function uses the service role and
-- bypasses RLS entirely, so this covers the manual/backfill path.
create policy "sms_notifications: staff write"
  on public.sms_notifications for all
  using (public.current_user_role() in ('faculty', 'admin'));
