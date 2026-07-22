-- ════════════════════════════════════════════════════════════════════
-- Phase 3 · Migration 0008 — Departments & Holidays (admin master data)
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- Two small admin-managed reference tables from the PDF's admin control
-- panel ("Manage Departments", "Manage Holidays"). Everyone signed in can
-- read them; only an admin writes (RLS). Holidays are a distinct calendar
-- an attendance policy can later exclude from denominators.
-- ════════════════════════════════════════════════════════════════════

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.holidays (
  id         uuid primary key default gen_random_uuid(),
  day        date not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;
alter table public.holidays enable row level security;

create policy "departments: read for authenticated"
  on public.departments for select
  using (auth.uid() is not null);

create policy "departments: admin writes"
  on public.departments for all
  using (public.current_user_role() = 'admin');

create policy "holidays: read for authenticated"
  on public.holidays for select
  using (auth.uid() is not null);

create policy "holidays: admin writes"
  on public.holidays for all
  using (public.current_user_role() = 'admin');

-- A few departments so the panel isn't empty on first run (idempotent).
insert into public.departments (code, name) values
  ('CSE', 'Computer Science & Engineering'),
  ('CA',  'Computer Applications'),
  ('ECE', 'Electronics & Communication'),
  ('ME',  'Mechanical Engineering')
on conflict (code) do nothing;
