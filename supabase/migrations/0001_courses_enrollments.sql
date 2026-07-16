-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0001 — Courses & Enrollments
-- Run AFTER schema.sql, in Supabase → SQL Editor.
--
-- Non-destructive. Normalizes the free-text `course` field behind a
-- `courses` table so the UI can render name + credits + semester, and
-- introduces per-semester `enrollments` so the attendance denominator
-- (sessions a student was expected at) becomes well-defined.
--
-- Order matters: create courses → backfill existing codes → add FKs
-- (so no existing sessions/marks row violates the new constraint).
-- ════════════════════════════════════════════════════════════════════

-- ── 1) courses ───────────────────────────────────────────────────────
create table if not exists public.courses (
  code       text primary key,               -- e.g. 'UQ24CA221B'
  name       text not null,                   -- e.g. 'Personality Development'
  credits    numeric(3, 1) not null default 0,
  semester   text not null,                   -- e.g. 'Sem-4'
  created_at timestamptz not null default now()
);

-- ── 2) Backfill distinct existing course codes ───────────────────────
-- Existing Phase-1 rows carry free-text course values (e.g. 'Data
-- Structures'). Seed them as placeholder courses so the FKs below hold;
-- real name/credits/semester are corrected via seed.sql or the staff UI.
insert into public.courses (code, name, credits, semester)
select distinct course, course, 0, 'Unknown'
from public.sessions
where course is not null
on conflict (code) do nothing;

insert into public.courses (code, name, credits, semester)
select distinct course, course, 0, 'Unknown'
from public.marks
where course is not null
on conflict (code) do nothing;

-- ── 3) Link existing tables to courses ───────────────────────────────
-- Guarded so re-running the migration does not error on the constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sessions_course_fkey'
  ) then
    alter table public.sessions
      add constraint sessions_course_fkey
      foreign key (course) references public.courses (code);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'marks_course_fkey'
  ) then
    alter table public.marks
      add constraint marks_course_fkey
      foreign key (course) references public.courses (code);
  end if;
end $$;

-- ── 4) enrollments ───────────────────────────────────────────────────
create table if not exists public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  course_code text not null references public.courses (code),
  enrolled_at timestamptz not null default now(),
  active      boolean not null default true,
  unique (student_id, course_code)
);

create index if not exists enrollments_student_idx
  on public.enrollments (student_id);

-- Attendance-summary denominator query filters sessions by course and
-- whether they are closed; back it with a covering index.
create index if not exists sessions_course_closed_idx
  on public.sessions (course, closed_at);

-- ── 5) Row-Level Security ────────────────────────────────────────────
alter table public.courses     enable row level security;
alter table public.enrollments enable row level security;

-- courses: any signed-in user reads; only staff write.
create policy "courses: read for authenticated"
  on public.courses for select
  using (auth.uid() is not null);

create policy "courses: staff manage"
  on public.courses for all
  using (public.current_user_role() in ('faculty', 'admin'));

-- enrollments: a student reads their own; staff read/manage all.
create policy "enrollments: read own or staff"
  on public.enrollments for select
  using (
    student_id = auth.uid()
    or public.current_user_role() in ('faculty', 'admin')
  );

create policy "enrollments: staff manage"
  on public.enrollments for all
  using (public.current_user_role() in ('faculty', 'admin'));
