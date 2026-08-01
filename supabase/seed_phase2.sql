-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Demo seed — courses, enrollments, sessions, attendance
-- Run AFTER 0001_courses_enrollments.sql and 0002_attendance_summary_view.sql.
--
-- Idempotent: it deletes and rebuilds the demo data for these course
-- codes each run, so re-running is safe.
--
-- ⚠ COURSE CODES ARE PLACEHOLDERS except UQ24CA221B (from the real PES
--   portal screenshot). The SEM4-* codes and all credit values are
--   invented for the demo — replace with real PES codes/credits before
--   any non-demo use. Names are correct; codes/credits are TODO.
-- ════════════════════════════════════════════════════════════════════

-- Everything in one batch so the temp config table lives for the whole run.

create temp table cfg (
  code      text,
  name      text,
  credits   numeric(3,1),
  conducted int,
  attended  int,   -- present + late + partial for the FIRST (rank 1) student
  late      int,
  partial   int
) on commit drop;

insert into cfg values
  ('UQ24CA221B', 'Personality Development',                         2.0, 34, 26, 2, 0), -- 76.47% eligible (screenshot)
  ('SEM4-CRYPTO','Cryptography',                                    4.0, 30, 18, 2, 0), -- 60.00% SHORTFALL
  ('SEM4-SE',    'Software Engineering',                            4.0, 28, 26, 1, 0), -- 92.86% eligible
  ('SEM4-ANIM',  'Animation',                                       3.0, 24, 20, 0, 1), -- 83.33% eligible
  ('SEM4-JAVA',  'Java Technologies',                               4.0, 32, 22, 1, 1), -- 68.75% SHORTFALL
  ('SEM4-EIE2',  'Essentials of Innovation & Entrepreneurship-II',  2.0, 20, 18, 0, 0); -- 90.00% eligible

-- 1) Upsert the six courses (fixes placeholder backfill if re-run).
insert into public.courses (code, name, credits, semester)
select code, name, credits, 'Sem-4' from cfg
on conflict (code) do update
  set name = excluded.name, credits = excluded.credits, semester = excluded.semester;

-- 2) Clean slate for the demo course codes (attendance cascades from sessions).
delete from public.sessions   where course      in (select code from cfg);
delete from public.enrollments where course_code in (select code from cfg);

-- 3) Enroll every student, with enrolled_at safely BEFORE all demo sessions
--    (the view only counts sessions opened on/after enrollment).
insert into public.enrollments (student_id, course_code, enrolled_at)
select p.id, c.code, now() - interval '200 days'
from public.profiles p
cross join cfg c
where p.role = 'student'
on conflict (student_id, course_code) do nothing;

-- 4) Create `conducted` CLOSED sessions per course, staggered into the past.
insert into public.sessions (course, geofence_id, faculty_id, opened_at, closed_at)
select
  c.code,
  (select id from public.geofences limit 1),
  (select id from public.profiles where role = 'faculty' limit 1),
  now() - ((c.conducted - g.n) * interval '2 days') - interval '20 days',
  now() - ((c.conducted - g.n) * interval '2 days') - interval '20 days' + interval '50 minutes'
from cfg c
cross join generate_series(1, c.conducted) as g(n);

-- 5) Attendance rows. Student rank r (1 = first student) attends
--    (attended - (r-1)*3) of the ranked sessions; the rest are absent
--    (no row). Within attended: present, then late, then partial.
with student_rank as (
  -- The primary demo login (student@pesu.pesu.pes.edu) is rank 1 → exact target
  -- numbers (26/34 hero); other students get the (r-1)*3 reduction.
  select p.id,
         row_number() over (
           order by (case when u.email = 'student@pesu.pesu.pes.edu' then 0 else 1 end),
                    p.created_at
         ) as r
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student'
),
sess_ranked as (
  select id, course, opened_at, closed_at,
         row_number() over (partition by course order by opened_at) as rn
  from public.sessions
  where course in (select code from cfg)
),
adj as (
  select
    sr.id       as student_id,
    sr.r,
    c.code,
    c.late,
    c.partial,
    greatest(c.late + c.partial, c.attended - (sr.r - 1) * 3) as attended_adj
  from student_rank sr
  cross join cfg c
)
insert into public.attendance (session_id, student_id, entry_time, exit_time, status)
select
  s.id,
  a.student_id,
  s.opened_at + interval '2 minutes',
  s.closed_at,
  (case
     when s.rn <= (a.attended_adj - a.late - a.partial) then 'present'
     when s.rn <= (a.attended_adj - a.partial)          then 'late'
     else 'partial'
   end)::public.att_status
from adj a
join sess_ranked s on s.course = a.code
where s.rn <= a.attended_adj;

-- 6) Confirm: per-student per-course rollup from the view.
select p.full_name, v.course_code, v.conducted,
       (v.present_cnt + v.late_cnt + v.partial_cnt) as attended,
       v.official_pct, v.weighted_pct
from public.attendance_summary v
join public.profiles p on p.id = v.student_id
order by p.full_name, v.course_code;

