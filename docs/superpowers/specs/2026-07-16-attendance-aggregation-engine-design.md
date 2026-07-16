# Attendance Aggregation Engine — Design Spec

**Date:** 2026-07-16
**Status:** Draft for user review
**Branch:** `claude/attendance-engine-spec-6k35hn`
**Sub-project:** 1 of 4 (Phase 2). Precedes: Face Identity (2), Academic Results (3), Rich Profile (4).

---

## 1. Problem & Goal

Phase 1 records raw attendance events (entry/exit, late/partial, geofence, face-detection score) but cannot answer the question that actually matters to students and staff:

> "What is my attendance percentage in each subject, and am I eligible (≥ 75%)?"

Today the system cannot compute this at all, for two reasons:

1. An attendance row exists only when a student marks in. An absent student leaves **no row**, so "absent" is indistinguishable from "not enrolled."
2. There is no record of **which students take which courses**, so the denominator (sessions the student was expected at) is undefined.

**Goal:** a correct, semester-aware attendance-percentage engine that mirrors the real PES "My Attendance" portal (course code + name, attended/conducted, %, per-semester) and adds a **75%-per-subject eligibility gate** — surfaced to students, faculty, and admin.

This sub-project is data + logic first, but per the agreed approach each page is built with production-grade visual design from day one (see §8), not styled later.

---

## 2. Scope

**In scope**

- `courses` and `enrollments` tables; semester-aware model.
- `attendance_summary` SQL view (per student × course) computing conducted / attended / official % / weighted %.
- `lib/attendance.ts` — single source of truth for policy constants + pure, tested helpers.
- Student "My Attendance" page (semester dropdown, per-course rows, eligibility badges).
- Faculty per-course attendance report.
- Admin institution rollup.
- Shortfall/eligibility flagging driven by one threshold constant.
- Minimal course + enrollment management (staff) and seed data for the demo.
- Shared design-system foundation established here and reused by later sub-projects.

**Out of scope (YAGNI / later sub-projects)**

- Face identity/liveness (sub-project 2).
- ISA/ESA marks, grades, SGPA/CGPA (sub-project 3 — Academic Results).
- Rich profile fields / Aadhaar (sub-project 4).
- CSV/PDF export, SMS-to-parent (noted as future hooks only).
- PostGIS, Supabase Realtime.

---

## 3. Data Model Changes

Non-destructive. `course` stays a text code but is normalized behind a `courses` table so the UI can render name + credits + semester exactly like the reference portal.

### 3.1 New: `courses`

```sql
create table public.courses (
  code       text primary key,              -- e.g. 'UQ24CA221B'
  name       text not null,                 -- e.g. 'Personality Development'
  credits    numeric(3,1) not null default 0,
  semester   text not null,                 -- e.g. 'Sem-4'
  created_at timestamptz not null default now()
);
```

### 3.2 New: `enrollments`

```sql
create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  course_code text not null references public.courses(code),
  enrolled_at timestamptz not null default now(),
  active      boolean not null default true,
  unique (student_id, course_code)
);
```

### 3.3 Link existing tables to `courses`

`sessions.course` and `marks.course` become FK references to `courses.code`. Existing values must be backfilled into `courses` first (migration seeds distinct codes). To avoid breaking Phase-1 data, the migration:

1. inserts distinct existing `course` values into `courses` with placeholder name/credits/semester,
2. then adds the FK.

Names/credits are corrected via the course-management UI or seed. No column rename in Phase-1 code paths; `course` / `course_code` text continues to match.

### 3.4 The denominator, defined precisely

For a `(student, course)`:

- **conducted** = count of `sessions` where `session.course = course`, `session.closed_at IS NOT NULL` (only concluded classes count), and `session.opened_at >= enrollment.enrolled_at`.
- Each conducted session contributes an outcome via `LEFT JOIN attendance` on `(session_id, student_id)`:
  - row present → its status (`present` / `late` / `partial`).
  - no row → **absent**.  ← this is how absent is finally derived.

---

## 4. Scoring Rules

Two percentages per `(student, course)`:

| Metric | Formula | Purpose |
|---|---|---|
| **Official %** | `(present + late + partial) / conducted` | The 75% eligibility gate. Any attendance = attended. |
| **Weighted %** | `(1.0·present + 0.5·late + 0.5·partial) / conducted` | Quality view; makes late/early-exit visible. |

- **Eligibility:** `official% >= 75` per course. Below → "At risk / Not eligible" badge.
- **Empty denominator** (`conducted = 0`) → render "No data", never 0%.
- Weights and threshold live in one place (`lib/attendance.ts`); the SQL view returns raw counts, app code applies the threshold so policy is trivially changeable.

### Decided: late counts toward eligibility

`late` counts as **attended** toward the 75% eligibility gate (confirmed 2026-07-16) — matches real university rules: a late student was still present. Official % is therefore `(present + late + partial) / conducted`.

---

## 5. Logic Layer — `lib/attendance.ts`

Pure, framework-agnostic, unit-testable:

- **Constants:** `ELIGIBILITY_THRESHOLD = 75`, `STATUS_WEIGHTS = { present:1, late:0.5, partial:0.5, absent:0 }`.
- `isEligible(officialPct): boolean`
- `formatPct(n): string` (handles "No data")
- `summarizeStudent(rows)` → overall rollup across courses (counts, worst course, any-shortfall).
- **Data access:** thin Supabase query wrappers returning typed rows from `attendance_summary`.

No React, no side effects → fast tests.

---

## 6. SQL View — `attendance_summary`

One row per `(student_id, course_code)` with: `conducted`, `present_cnt`, `late_cnt`, `partial_cnt`, `absent_cnt`, `official_pct`, `weighted_pct`, plus `course.name`, `course.credits`, `course.semester` for direct rendering.

- **Security-invoker** so existing RLS on base tables governs visibility (students see their own; staff see all).
- Backed by existing indexes on `attendance(session_id, student_id)` and `sessions(course, closed_at)` (add index if missing).
- **Materialized view is not used** (institution-scale data is small; live view keeps it simple). Noted as a future optimization only.

---

## 7. Surfaces

### 7.1 Student — "My Attendance" (rebuild of student dashboard section)

- Semester dropdown (from distinct `courses.semester` for the student's enrollments).
- Per-course rows: Course Code · Course Name · attended/conducted · Official % · Weighted % · eligibility badge, mirroring the PES layout but visually elevated (see §8).
- Overall banner: "⚠ Not eligible — below 75% in Cryptography, Java Technologies" when any course is short; positive state otherwise.
- Reuses existing `AttendanceRing` (`components/charts/attendance-ring.tsx`) for the headline per-course meter.

### 7.2 Faculty — `/faculty/attendance`

Course picker → table of every enrolled student's official %, weighted %, attended/conducted, eligibility badge. Sortable; shortfall rows highlighted. Foundation for later CSV export.

### 7.3 Admin — institution rollup

Cross-course averages, count of students below 75%, worst-performing courses.

### 7.4 Shortfall flagging

One threshold constant drives every "at-risk" badge. Future hook: SMS to `profiles.parent_phone` (not built now).

### 7.5 Course + enrollment management (staff)

Minimal admin/faculty UI: create/edit courses (code, name, credits, semester); enroll students into a course (multi-select). Seed script provides demo data so the pipeline is demoable without manual entry. RLS: students read own enrollments; staff manage.

---

## 8. Visual Design (baked in, not deferred)

Per the agreed approach, this sub-project establishes the shared design system that all four sub-projects reuse, then builds its pages beautiful from day one:

- Extend the existing PES token set (navy `#1E3A8A` / orange `#E8792B`, Sora/Inter/JetBrains Mono, three-layer tokens in `app/globals.css`).
- Design driven by the named build-time UI skills during implementation — **not** invoked during spec.
- **Reference-to-beat:** the three PES portal screenshots (attendance, results, profile). Ours must be clearly more polished: real hierarchy, status pills (never color-only), motion via existing GSAP layer, responsive, `prefers-reduced-motion` respected.
- Status colors always paired with icon + label (carried over from Phase-1 design rules).

---

## 9. Testing

- **Unit** (`lib/attendance.ts`): weighting math; eligibility boundaries at 74.9 / 75.0 / 75.1; empty-denominator → "No data"; overall rollup with mixed statuses.
- **View validation:** run `attendance_summary` against extended `seed.sql` fixtures with hand-computed expected numbers (e.g. a student with 26/34 → 76%).
- **RLS check:** a student cannot read another student's summary rows; staff can.
- **Build gate:** `npm run build` + `tsc --noEmit` clean.

---

## 10. Migration & Rollout Order

1. Add `courses`, backfill distinct existing `course` codes (placeholder metadata).
2. Add FKs from `sessions.course` / `marks.course` → `courses.code`.
3. Add `enrollments` + RLS.
4. Create `attendance_summary` view.
5. Seed demo courses + enrollments (semester-tagged).
6. Build `lib/attendance.ts` + tests.
7. Build surfaces (student → faculty → admin), each with design baked in.

---

## 11. Risks / Notes

- **Backfill correctness** — placeholder course names must be corrected via UI/seed before demo, or the attendance table shows codes without names.
- **Text `course_code` keys** (not UUIDs) are intentional to match Phase-1 data and the real portal; acceptable given fixed, human-readable course codes.
- **Uncommitted work is ephemeral** — this environment reclaims the container between sessions, so files must be committed to survive. (This spec was lost once for exactly this reason and re-materialized from the conversation record.)
