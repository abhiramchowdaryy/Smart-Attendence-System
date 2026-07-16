-- ════════════════════════════════════════════════════════════════════
-- PES Smart Attendance — Schema (Phase 1)
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
--
-- Conventions (Postgres best practices):
--   • text over varchar(n)      • timestamptz over timestamp
--   • uuid primary keys         • RLS on every table
-- Geofencing uses plain lat/lng + Haversine (server action) for the MVP;
-- swap to PostGIS geography + ST_DWithin in Phase 2 if desired.
-- ════════════════════════════════════════════════════════════════════

-- ── Enums ─────────────────────────────────────────────────────────────
create type public.user_role as enum ('student', 'faculty', 'admin');
create type public.att_status as enum ('present', 'late', 'absent', 'partial');

-- ── Tables ────────────────────────────────────────────────────────────

-- One profile per auth user; created automatically by trigger below.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default 'New User',
  roll_no text unique,
  role public.user_role not null default 'student',
  parent_phone text,            -- Phase 2: Twilio SMS target
  face_embedding jsonb,         -- Phase 2: enrolled 128-d descriptor
  created_at timestamptz not null default now()
);

-- A named classroom location with an allowed radius.
create table public.geofences (
  id uuid primary key default gen_random_uuid(),
  room_name text not null,
  lat numeric(9, 6) not null,
  lng numeric(9, 6) not null,
  radius_m integer not null default 50 check (radius_m between 5 and 2000),
  created_at timestamptz not null default now()
);

-- A class window opened by faculty; students mark while it is open.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  course text not null,
  faculty_id uuid references public.profiles (id) on delete set null,
  geofence_id uuid not null references public.geofences (id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  check (closed_at is null or closed_at >= opened_at)
);

-- One row per student per session; entry now, exit later.
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  entry_time timestamptz not null default now(),
  exit_time timestamptz,
  duration_min integer generated always as
    (cast(extract(epoch from (exit_time - entry_time)) / 60 as integer)) stored,
  status public.att_status not null default 'present',
  face_confidence numeric(4, 3),        -- browser detection score (Phase 1)
  entry_lat numeric(9, 6),
  entry_lng numeric(9, 6),
  unique (session_id, student_id),
  check (exit_time is null or exit_time >= entry_time)
);

-- Assessment scores; only faculty/admin may write (RLS below).
create table public.marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  course text not null,
  assessment text not null,
  score numeric(6, 2) not null check (score >= 0),
  max_score numeric(6, 2) not null default 100 check (max_score > 0),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now(),
  unique (student_id, course, assessment)
);

-- ── Indexes for the dashboard queries ────────────────────────────────
create index attendance_student_entry_idx
  on public.attendance (student_id, entry_time desc);
create index attendance_session_idx on public.attendance (session_id);
create index sessions_open_idx
  on public.sessions (opened_at desc) where closed_at is null;
create index marks_student_idx on public.marks (student_id);

-- ── Auto-create a profile when a user signs up ───────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Role helper (security definer avoids RLS recursion on profiles) ──
create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ── Row-Level Security ────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.geofences enable row level security;
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
alter table public.marks enable row level security;

-- profiles: read own; staff read all; users edit their own name only.
create policy "profiles: read own or staff"
  on public.profiles for select
  using (id = auth.uid() or public.current_user_role() in ('faculty', 'admin'));

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());  -- users cannot self-promote

create policy "profiles: admin full access"
  on public.profiles for all
  using (public.current_user_role() = 'admin');

-- geofences: everyone signed-in can read; only admin writes.
create policy "geofences: read for authenticated"
  on public.geofences for select
  using (auth.uid() is not null);

create policy "geofences: admin writes"
  on public.geofences for all
  using (public.current_user_role() = 'admin');

-- sessions: everyone signed-in can read; faculty/admin manage.
create policy "sessions: read for authenticated"
  on public.sessions for select
  using (auth.uid() is not null);

create policy "sessions: staff manage"
  on public.sessions for all
  using (public.current_user_role() in ('faculty', 'admin'));

-- attendance: students insert/update their OWN rows; staff read all.
create policy "attendance: read own or staff"
  on public.attendance for select
  using (
    student_id = auth.uid()
    or public.current_user_role() in ('faculty', 'admin')
  );

create policy "attendance: student inserts own"
  on public.attendance for insert
  with check (student_id = auth.uid());

create policy "attendance: student updates own (exit)"
  on public.attendance for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "attendance: staff manage"
  on public.attendance for all
  using (public.current_user_role() in ('faculty', 'admin'));

-- marks: students read their own; only staff write.
create policy "marks: read own or staff"
  on public.marks for select
  using (
    student_id = auth.uid()
    or public.current_user_role() in ('faculty', 'admin')
  );

create policy "marks: staff write"
  on public.marks for insert
  with check (public.current_user_role() in ('faculty', 'admin'));

create policy "marks: staff update"
  on public.marks for update
  using (public.current_user_role() in ('faculty', 'admin'));
