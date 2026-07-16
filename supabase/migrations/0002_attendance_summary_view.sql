-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0002 — attendance_summary view
-- Run AFTER 0001_courses_enrollments.sql.
--
-- One row per (student, enrolled course). The denominator (`conducted`)
-- counts only CLOSED sessions of that course opened on/after the
-- student's enrollment. Attendance outcomes come from a LEFT JOIN, so a
-- missing attendance row is finally interpretable as ABSENT.
--
-- security_invoker = true → the querying user's RLS on the base tables
-- governs visibility (students see only their own rows; staff see all).
-- Requires Postgres 15+ (project runs 17).
-- ════════════════════════════════════════════════════════════════════

create or replace view public.attendance_summary
with (security_invoker = true) as
select
  e.student_id,
  e.course_code,
  c.name     as course_name,
  c.credits,
  c.semester,
  count(s.id)                                                       as conducted,
  count(a.id) filter (where a.status = 'present')                   as present_cnt,
  count(a.id) filter (where a.status = 'late')                      as late_cnt,
  count(a.id) filter (where a.status = 'partial')                   as partial_cnt,
  count(s.id)
    - count(a.id) filter (where a.status in ('present','late','partial')) as absent_cnt,
  case
    when count(s.id) = 0 then null
    else round(
      100.0 * count(a.id) filter (where a.status in ('present','late','partial'))
        / count(s.id), 2)
  end as official_pct,
  case
    when count(s.id) = 0 then null
    else round(
      100.0 * (
        count(a.id) filter (where a.status = 'present')
        + 0.5 * count(a.id) filter (where a.status = 'late')
        + 0.5 * count(a.id) filter (where a.status = 'partial')
      ) / count(s.id), 2)
  end as weighted_pct
from public.enrollments e
join public.courses c
  on c.code = e.course_code
left join public.sessions s
  on s.course = e.course_code
  and s.closed_at is not null
  and s.opened_at >= e.enrolled_at
left join public.attendance a
  on a.session_id = s.id
  and a.student_id = e.student_id
where e.active
group by e.student_id, e.course_code, c.name, c.credits, c.semester;

comment on view public.attendance_summary is
  'Per (student, course) attendance rollup. conducted = closed sessions since enrollment; official_pct gates the 75% rule; weighted_pct halves late/partial. NULL percentages when conducted = 0.';
