-- ════════════════════════════════════════════════════════════════════
-- Phase 3 · Migration 0009 — Timetable (admin "Manage Timetable")
-- Run AFTER 0001 (courses) and the earlier migrations.
--
-- A weekly class schedule: one row per (course, day, start time). Everyone
-- signed in can read it (students/faculty view their week); only an admin
-- edits. Day of week is 1 = Monday … 6 = Saturday (college week).
-- ════════════════════════════════════════════════════════════════════

create table public.timetable (
  id          uuid primary key default gen_random_uuid(),
  course_code text not null references public.courses (code) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 6),
  start_time  time not null,
  end_time    time not null,
  section     text,
  created_at  timestamptz not null default now(),
  unique (course_code, day_of_week, start_time),
  check (end_time > start_time)
);

create index timetable_day_idx on public.timetable (day_of_week, start_time);

alter table public.timetable enable row level security;

create policy "timetable: read for authenticated"
  on public.timetable for select
  using (auth.uid() is not null);

create policy "timetable: admin writes"
  on public.timetable for all
  using (public.current_user_role() = 'admin');

-- A few slots for existing courses so the grid isn't empty (idempotent,
-- and only for courses that actually exist).
insert into public.timetable (course_code, day_of_week, start_time, end_time, section)
select t.code, t.dow, t.st::time, t.et::time, 'A'
from (values
  ('SEM4-SE',     1, '09:00', '10:00'),
  ('SEM4-JAVA',   1, '10:00', '11:00'),
  ('SEM4-CRYPTO', 2, '09:00', '10:00'),
  ('SEM4-ANIM',   3, '11:00', '12:00'),
  ('SEM4-SE',     4, '09:00', '10:00'),
  ('SEM4-JAVA',   5, '10:00', '11:00')
) as t(code, dow, st, et)
where exists (select 1 from public.courses c where c.code = t.code)
on conflict (course_code, day_of_week, start_time) do nothing;
