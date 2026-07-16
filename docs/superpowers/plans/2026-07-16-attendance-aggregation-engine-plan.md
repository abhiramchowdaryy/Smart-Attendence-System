# Attendance Aggregation Engine — Implementation Plan

**Date:** 2026-07-16
**Branch:** `claude/attendance-engine-spec-6k35hn`
**Spec:** [../specs/2026-07-16-attendance-aggregation-engine-design.md](../specs/2026-07-16-attendance-aggregation-engine-design.md)

Each step lists the files touched and its own verification. Steps are ordered so the DB and logic layer are proven before any UI is built.

---

## Step 1 — Schema migration: `courses`, `enrollments`, FKs

**Files:** `supabase/migrations/0002_courses_enrollments.sql` (new)

1. `create table public.courses (code pk, name, credits, semester, created_at)`.
2. Backfill: `insert into courses (code, name, credits, semester) select distinct course, course, 0, 'Unknown' from sessions ... on conflict do nothing;` (placeholder name = code).
3. Add FK `sessions.course → courses.code` and `marks.course → courses.code` (after backfill so nothing violates).
4. `create table public.enrollments (...)` with `unique (student_id, course_code)`.
5. Enable RLS on both; policies:
   - `courses`: read for authenticated; staff write.
   - `enrollments`: student reads own; staff manage.
6. Add index `sessions_course_closed_idx on sessions(course, closed_at)` if not present.

**Verify:** apply to a Supabase branch; `list_tables` shows both tables; inserting a `sessions` row with an unknown course fails the FK.

---

## Step 2 — `attendance_summary` view

**Files:** `supabase/migrations/0003_attendance_summary_view.sql` (new)

- `create view public.attendance_summary with (security_invoker = true) as ...`
- Per `(student_id, course_code)`: join `enrollments → sessions` (closed, `opened_at >= enrolled_at`) `LEFT JOIN attendance`.
- Columns: `conducted, present_cnt, late_cnt, partial_cnt, absent_cnt, official_pct, weighted_pct, name, credits, semester`.
- `absent_cnt = conducted - (present+late+partial)`; percentages `null` when `conducted = 0`.

**Verify:** query against seeded fixtures (Step 5); hand-checked case 26/34 → official 76.47%. RLS: student A cannot see student B's rows.

---

## Step 3 — Logic layer `lib/attendance.ts` + tests

**Files:** `lib/attendance.ts` (new), `lib/attendance.test.ts` (new)

- Constants `ELIGIBILITY_THRESHOLD = 75`, `STATUS_WEIGHTS`.
- Pure helpers: `isEligible`, `formatPct`, `summarizeStudent`.
- Typed row interface matching the view; thin Supabase query wrappers.

**Verify:** unit tests — boundaries 74.9 / 75.0 / 75.1, empty denominator → "No data", mixed-status rollup. `tsc --noEmit` clean.

---

## Step 4 — Seed: real demo courses + enrollments

**Files:** `supabase/seed.sql` (extend)

Sem-4 courses from the reference portal (credits are placeholders until confirmed):

| code | name | credits | semester |
|---|---|---|---|
| UQ24CA221B | Personality Development | 0 | Sem-4 |
| (tbd) | Cryptography | 4 | Sem-4 |
| (tbd) | Software Engineering | 4 | Sem-4 |
| (tbd) | Animation | 3 | Sem-4 |
| (tbd) | Java Technologies | 4 | Sem-4 |
| (tbd) | Essentials of Innovation & Entrepreneurship-II | 2 | Sem-4 |

- Enroll the demo student(s) into all six.
- Generate enough closed `sessions` + `attendance` rows so at least one course lands below 75% (to exercise the shortfall banner) and Personality Development reproduces 26/34.

**Verify:** run seed; `attendance_summary` returns the six rows with expected numbers; one course flagged not-eligible.

> **Open:** real credit values and the five missing course codes. Placeholders used until you supply them.

---

## Step 5 — Student "My Attendance" surface

**Files:** `app/student/dashboard/page.tsx` (extend) or new `app/student/attendance/page.tsx`; shared UI in `components/`

- Semester dropdown from the student's enrolled semesters.
- Per-course rows (code · name · attended/conducted · official % · weighted % · eligibility badge), design baked in per spec §8.
- Overall banner naming short courses. Reuse `AttendanceRing`.

**Verify:** run app, log in as demo student, confirm rows match seed and the shortfall banner renders.

---

## Step 6 — Faculty course report

**Files:** `app/faculty/attendance/page.tsx` (new) + action

- Course picker → sortable table of enrolled students' official/weighted %, attended/conducted, badge; shortfall rows highlighted.

**Verify:** log in as faculty, pick a course, confirm the roster and flags.

---

## Step 7 — Admin rollup + course/enrollment management

**Files:** `app/admin/dashboard/page.tsx` (extend); minimal course/enrollment CRUD UI

- Cross-course averages, count below 75%, worst courses.
- Staff CRUD for courses; multi-select enroll.

**Verify:** log in as admin, confirm rollup numbers reconcile with per-course data; create a course and enroll a student end-to-end.

---

## Step 8 — Full build gate

`npm run build` + `tsc --noEmit` clean; unit tests green. Then hand to you for commit.

---

## Sequencing notes

- Steps 1→4 are backend/logic and can be verified without any UI.
- Design system (spec §8) is established during Step 5 and reused by 6–7.
- Nothing is committed by me at any step — files only; you commit when satisfied.
