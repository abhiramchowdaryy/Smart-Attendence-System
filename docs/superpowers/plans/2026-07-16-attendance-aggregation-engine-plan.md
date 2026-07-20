# Attendance Aggregation Engine — Implementation Plan

**Date:** 2026-07-16
**Branch:** `claude/attendance-engine-spec-6k35hn`
**Spec:** [../specs/2026-07-16-attendance-aggregation-engine-design.md](../specs/2026-07-16-attendance-aggregation-engine-design.md)

Each step lists the files touched and its own verification. Steps are ordered so the DB and logic layer are proven before any UI is built.

> **Progress (2026-07-16):** Steps 1–3 complete and verified against the dev
> Supabase project `Smart Attendance`. Migrations live in
> `supabase/migrations/0001_*` and `0002_*` (numbered from the `schema.sql`
> baseline, not `0002/0003` as originally sketched below). Step 4 (seed) is
> blocked on real course codes/credits.

---

## Step 1 — Schema migration: `courses`, `enrollments`, FKs — ✅ DONE

**Files:** `supabase/migrations/0001_courses_enrollments.sql`

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

## Step 2 — `attendance_summary` view — ✅ DONE

**Files:** `supabase/migrations/0002_attendance_summary_view.sql`

- `create view public.attendance_summary with (security_invoker = true) as ...`
- Per `(student_id, course_code)`: join `enrollments → sessions` (closed, `opened_at >= enrolled_at`) `LEFT JOIN attendance`.
- Columns: `conducted, present_cnt, late_cnt, partial_cnt, absent_cnt, official_pct, weighted_pct, name, credits, semester`.
- `absent_cnt = conducted - (present+late+partial)`; percentages `null` when `conducted = 0`.

**Verify:** query against seeded fixtures (Step 5); hand-checked case 26/34 → official 76.47%. RLS: student A cannot see student B's rows.

---

## Step 3 — Logic layer `lib/attendance.ts` + tests — ✅ DONE

**Files:** `lib/attendance.ts`, `lib/attendance.test.ts`

Tests run with `node --test lib/attendance.test.ts` (Node built-in runner +
native TS type-stripping; no test-framework dependency). 10/10 pass.
`tsc --noEmit` deferred to the Step 8 build gate (needs `npm install`).

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

## Step 5 — Student "My Attendance" surface — ✅ DONE

**Files:** `app/student/attendance/page.tsx` (new), `components/eligibility-badge.tsx`
(new), `components/app-shell.tsx` (nav link). Verified live via Playwright/Chromium
(logged in as student@pes.edu) in both light and dark themes; data matches the seed
(Personality Development 26/34 = 76.47%, 2 shortfalls). `tsc` + `next build` clean.

- Semester dropdown from the student's enrolled semesters.
- Per-course rows (code · name · attended/conducted · official % · weighted % · eligibility badge), design baked in per spec §8.
- Overall banner naming short courses. Reuse `AttendanceRing`.

**Verify:** run app, log in as demo student, confirm rows match seed and the shortfall banner renders.

---

## Step 6 — Faculty course report — ✅ DONE

**Files:** `app/faculty/attendance/page.tsx` (new), nav link in `app/../app-shell.tsx`

- Course picker (chips) → table of enrolled students' official/weighted %,
  attended/conducted, eligibility badge; shortfall rows highlighted and sorted
  to the top; per-course KPIs (enrolled, below-75, class average).

**Verified:** live Playwright render as faculty@pes.edu — Animation shows the
shortfall student (70.83%) sorted top and tinted, class average 77.08%.

---

## Step 7 — Admin rollup — ✅ DONE (management CRUD deferred)

**Files:** `app/admin/attendance/page.tsx` (new), `lib/attendance.ts`
(`fetchAllAttendance`, `rollupByCourse` + tests), nav links.

- Institution KPIs (courses, students below 75%, institution average, lowest
  course) + per-course rollup table, worst-average first, shortfall rows flagged.

**Verified:** live render as admin@pes.edu — 6 courses, 2 students below 75%,
institution avg 73.04%, Cryptography lowest at 55%; numbers reconcile with the
per-student view.

**§7.5 course/enrolment management — ✅ DONE (follow-up):**
`/faculty/courses` (faculty + admin) — course catalogue table with upsert
form (also fixes backfilled placeholder codes) and a per-course roster
editor. Unchecking deactivates the enrolment (`active = false`) instead of
deleting, so `enrolled_at` and attendance history survive re-enrolment.
Verified live as faculty@pes.edu. This closes every item in the spec.

---

## Step 8 — Full build gate — ✅ DONE

`next build` clean (only pre-existing face-api warnings), `tsc --noEmit` clean,
`node --test` 12/12 green. `tsconfig.json` gained `allowImportingTsExtensions`
so the Node-runnable test (`.ts` import) also type-checks. Handed to user for commit.

---

## Sequencing notes

- Steps 1→4 are backend/logic and can be verified without any UI.
- Design system (spec §8) is established during Step 5 and reused by 6–7.
- Nothing is committed by me at any step — files only; you commit when satisfied.
