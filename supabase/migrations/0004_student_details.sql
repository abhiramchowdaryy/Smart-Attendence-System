-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0004 — Rich student profile
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- One row per student with the identity fields the PES portal shows
-- (branch, section, DOB, blood group, SSLC/PUC, parents, address).
--
-- PRIVACY: Aadhaar is stored as LAST 4 DIGITS ONLY (aadhaar_last4) —
-- the full number is never persisted anywhere in this system, so a DB
-- leak cannot expose it. Display as ••••-••••-1234.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.student_details (
  student_id   uuid primary key references public.profiles (id) on delete cascade,
  pesu_id      text,
  branch       text,
  section      text,
  dob          date,
  blood_group  text,
  sslc_pct     numeric(5, 2) check (sslc_pct between 0 and 100),
  puc_pct      numeric(5, 2) check (puc_pct between 0 and 100),
  father_name  text,
  father_phone text,
  mother_name  text,
  mother_phone text,
  address      text,
  city         text,
  state        text,
  pincode      text,
  aadhaar_last4 text check (aadhaar_last4 ~ '^[0-9]{4}$'),
  updated_at   timestamptz not null default now()
);

alter table public.student_details enable row level security;

-- Students see their own row; staff see all (for support/verification).
create policy "student_details: read own or staff"
  on public.student_details for select
  using (
    student_id = auth.uid()
    or public.current_user_role() in ('faculty', 'admin')
  );

-- Students maintain their own details; admin can manage everyone's.
create policy "student_details: upsert own"
  on public.student_details for insert
  with check (student_id = auth.uid());

create policy "student_details: update own"
  on public.student_details for update
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "student_details: admin manage"
  on public.student_details for all
  using (public.current_user_role() = 'admin');
