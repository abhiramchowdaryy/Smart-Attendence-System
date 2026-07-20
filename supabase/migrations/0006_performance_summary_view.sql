-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0006 — student_performance view
--
-- /faculty/performance previously fetched EVERY attendance row and EVERY
-- marks row into the Node process and aggregated them in JavaScript with
-- two Maps. That has three problems at institution scale:
--
--   1. Transfer/memory grows with total history, not with the number of
--      students plotted — the page renders one dot per student but was
--      moving hundreds of thousands of rows to do it.
--   2. PostgREST applies a row ceiling when db-max-rows is configured.
--      A truncated fetch does not error; it silently yields a WRONG
--      correlation coefficient, which is worse than a slow page.
--   3. Counting/averaging is exactly what the database is for.
--
-- Aggregating here returns one pre-computed row per student instead.
--
-- security_invoker = true → the querying user's RLS on the base tables
-- governs visibility, matching the attendance_summary precedent in 0002.
-- (Without it a view runs as its owner and silently bypasses RLS.)
-- ════════════════════════════════════════════════════════════════════

create or replace view public.student_performance
with (security_invoker = true) as
select
  p.id                                            as student_id,
  p.full_name,
  p.roll_no,
  coalesce(att.attended, 0)                       as attended,
  m.assessments,
  round(m.avg_pct, 2)                             as marks_pct
from public.profiles p
join lateral (
  -- Students with no marks are excluded (the scatter plots marks vs
  -- attendance, so a student without marks has no y value). An inner
  -- lateral join expresses that directly.
  select
    count(*)                                                   as assessments,
    avg(100.0 * mk.score / nullif(mk.max_score, 0))            as avg_pct
  from public.marks mk
  where mk.student_id = p.id
  having count(*) > 0
) m on true
left join lateral (
  select count(*) as attended
  from public.attendance a
  where a.student_id = p.id
    and a.status <> 'absent'
) att on true
where p.role = 'student';

comment on view public.student_performance is
  'One row per student holding attended-session count and mean marks percentage. Backs /faculty/performance so the correlation is computed over aggregates rather than raw history.';

-- The lateral subqueries filter attendance by (student_id, status); the
-- existing attendance_student_entry_idx leads with student_id and covers
-- the lookup. Marks are already covered by marks_student_idx.
