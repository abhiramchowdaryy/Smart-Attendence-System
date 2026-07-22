-- ════════════════════════════════════════════════════════════════════
-- Phase 3 · Migration 0007 — Attendance corrections (admin approval)
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- The PDF wants faculty to be able to EDIT attendance, but only with
-- ADMIN APPROVAL. So faculty don't mutate attendance directly — they file
-- a correction request against a specific attendance row; an admin then
-- approves (which applies the new status) or rejects it. Every request is
-- an auditable record of who asked, who decided, and why.
-- ════════════════════════════════════════════════════════════════════

create type public.correction_state as enum ('pending', 'approved', 'rejected');

create table public.attendance_corrections (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  requested_by  uuid not null references public.profiles (id),
  from_status   public.att_status not null,
  to_status     public.att_status not null,
  reason        text not null,
  state         public.correction_state not null default 'pending',
  decided_by    uuid references public.profiles (id),
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  check (to_status <> from_status)
);

-- At most one open request per attendance row (partial unique index).
create unique index attendance_corrections_one_pending
  on public.attendance_corrections (attendance_id)
  where state = 'pending';

create index attendance_corrections_pending_idx
  on public.attendance_corrections (created_at desc)
  where state = 'pending';

alter table public.attendance_corrections enable row level security;

-- Staff (faculty + admin) can read every request.
create policy "corrections: staff read"
  on public.attendance_corrections for select
  using (public.current_user_role() in ('faculty', 'admin'));

-- Faculty/admin file requests as themselves.
create policy "corrections: staff request"
  on public.attendance_corrections for insert
  with check (
    public.current_user_role() in ('faculty', 'admin')
    and requested_by = auth.uid()
  );

-- Only an admin approves/rejects (this is the "admin approval" gate).
create policy "corrections: admin decide"
  on public.attendance_corrections for update
  using (public.current_user_role() = 'admin');
