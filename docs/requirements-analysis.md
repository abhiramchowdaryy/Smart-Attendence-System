# Requirements Analysis & Architecture Review

Smart Attendance System — PES University. This document is the written
deliverable for the requirements the two `Requirements*.pdf` specs describe,
mapped against the **existing Phase-1 + Phase-2 codebase**. It drives the
implementation that ships alongside it (the AI performance-analysis module).

> **Reading note.** A large share of the spec is *already built* (auth,
> role guards, RLS, mark-attendance with face match + geofence, 75% engine,
> results/GPA, profile, courses/enrolments, faculty/admin reports). This
> analysis flags what is **done**, what is **missing**, and what **conflicts**
> with the working system so nothing is silently rewritten.

---

## PHASE 1 — Requirement Analysis

### 1. Executive Summary

The system is a role-based (Admin / Faculty / Student) attendance platform
that verifies a student by **face match + liveness** and **geofence**, records
**entry/exit** with a graded status, rolls attendance up against a **75%
eligibility** rule, and — the spec's stated "main thing" — **analyses the
relationship between attendance and academic performance** to produce
personalised feedback and a lightweight prediction. Most attendance/results
machinery already exists; the performance-analysis layer did not, and is the
focus of this change.

### 2. Feature List

Legend: ✅ built · 🟡 partial · ❌ missing · ⚠️ conflicts with current design.

| # | Feature | Status |
|---|---------|--------|
| Roles: Admin / Faculty / Student | ✅ (`user_role` enum, RLS, role guards) |
| Login: role select → credentials, logo, remember-me, forgot password, register-number (`PES1UG24CA119`) | ⚠️ email/password only today; role derives from profile |
| Student dashboard: name, ID, dept, sem, section, photo | 🟡 name+roll+KPIs; dept/section/photo not surfaced |
| Attendance summary / history / today's hours | 🟡 summary+history ✅; per-hour (1st/2nd/3rd) ❌ |
| Notifications (marked / below 75%) | 🟡 eligibility badges exist; no notification feed |
| Student profile (mobile, parent contact, …) | ✅ `student_details` + profile page |
| Faculty: classes, take attendance, face recog, reports, search, edit (admin approval), download | 🟡 most ✅; correction-approval workflow + export ❌ |
| Admin: manage students/faculty/subjects/depts/classes/timetable/holidays, reports, export | 🟡 users+geofence+GPS+rollups ✅; subjects/depts/timetable/holidays CRUD + export ❌ |
| Attendance process: entry→exit, auto status | ✅ (`markEntry`/`markExit`) |
| Status model: Present / Late Entry / Early Exit / Partial / Absent | ⚠️ enum is present/late/absent/partial; no distinct **early-exit**; weights differ (see §8) |
| GPS + Wi-Fi fallback, geofence 100–150 m | 🟡 GPS geofence ✅ (Haversine + grace); Wi-Fi SSID fallback ❌ |
| Face recog: detect, match, reject unknown/multiple, anti-spoof | ✅ match + blink liveness; multi-face reject 🟡 |
| **Performance module** (IA marks, avg, attendance %) | ✅ marks + attendance already stored |
| **AI performance analysis** (personalised feedback) | ✅ **shipped in this change** (`lib/performance`) |
| **Performance prediction** (grade / risk / improvement) | ✅ **shipped in this change** |
| Faculty/admin performance reports, students at risk | 🟡 correlation ✅; **risk/intervention flag shipped in this change** |
| Export Excel / PDF | ❌ |

### 3. User Stories (representative)

- *As a student* I sign in, see my attendance %, marks, and **personalised
  guidance** on how to improve, plus my predicted grade and risk level.
- *As a student* I mark attendance only when my **live face matches my
  enrolment** and I am **inside the classroom geofence**.
- *As a faculty member* I open a session, watch the live roster, and see
  **which students need intervention** (low attendance or marks).
- *As an admin* I manage users and the geofence/GPS policy and read
  institution-wide attendance rollups.

### 4. Functional Requirements (highlights)

FR-1 role-based auth + redirect · FR-2 face-verified, geofenced entry ·
FR-3 exit capture + auto status · FR-4 75% eligibility rollup ·
FR-5 marks entry + results/GPA · FR-6 **attendance↔performance analysis +
prediction** · FR-7 faculty live roster + reports · FR-8 admin management +
rollups.

### 5. Non-Functional Requirements

Security (RLS, server-side re-validation, first-write face enrolment) ·
Performance (parallel reads, indexed queries, single view for rollups) ·
Accessibility (state via icon+label, never colour alone; labelled inputs) ·
Privacy (Aadhaar last-4 only; face descriptor never shipped to admin list) ·
Free-tier operability · Mobile/secure-context (camera+geo need HTTPS).

### 6. Acceptance Criteria (for the shipped change)

- Given both attendance % and average marks %, the student sees a headline,
  personalised feedback matching the correct **quadrant**, an expected grade,
  a risk level, an improvement probability, and a recommended action.
- Given either value missing, an honest "not enough data" state shows — never
  a fabricated verdict.
- The four worked examples in the spec map to the four intended quadrants
  (covered by unit tests in `lib/performance.test.ts`).
- Faculty performance report shows a "Requiring intervention" count and a
  per-student risk/expected-grade column.

### 7. Missing Requirements (not in this change)

Per-hour (1st/2nd/3rd) attendance grid · notification feed · attendance-
correction approval workflow · subjects/departments/timetable/holidays CRUD ·
Excel/PDF export · Wi-Fi SSID fallback · student photo upload.

### 8. Ambiguities / Conflicts (need a product decision)

- **Attendance weights.** `Requirements_2.pdf` defines **Late Entry = 0.75,
  Early Exit = 0.75, Partial = 0.50, Absent = 0**. The current engine uses
  `late = 0.5, partial = 0.5` and has **no distinct Early-Exit status**
  (leaving early downgrades `present → partial`). Adopting the spec weights is
  a **breaking change** to a working, unit-tested engine + the `att_status`
  enum + the `attendance_summary` view. **Deferred pending your decision** —
  see §16.
- **Login model.** Spec wants a **role picker first**, **register-number
  login** (`PES1UG24CA119`), remember-me, and forgot-password. Supabase Auth
  is email-based; this is an auth rework (register-number → email mapping or a
  custom flow). **Deferred pending your decision.**
- **Marks "good" line.** Spec gives no numeric threshold for "good" marks;
  `70%` was chosen so the four worked examples land in the intended quadrants,
  and is a single named constant (`MARKS_GOOD_THRESHOLD`) for easy tuning.

### 9. Risks

Changing attendance weights invalidates historical percentages · auth rework
risks locking users out · export/CSV features touch PII (need RLS-safe paths).
The shipped change is **additive and low-risk** (no schema change, no write
paths, pure read-time computation).

### 10. Dependencies

Reuses `lib/results.gradeForPct` (grading) and `lib/attendance.ELIGIBILITY_THRESHOLD`
(75% gate) — no new npm packages, no new tables.

### 11. Technical Challenges

Keeping the "AI" analysis **deterministic and explainable** (no external model,
no latency, testable) while still feeling like guidance — solved with a
transparent quadrant rubric + a weighted projection.

### 12. Existing Modules Impacted (this change)

`app/student/dashboard/page.tsx` (adds insight card, reuses existing values) ·
`app/faculty/performance/page.tsx` (adds intervention KPI + risk columns).

### 13. New Modules Required (this change)

`lib/performance.ts` (pure logic) · `lib/performance.test.ts` (unit tests) ·
`components/performance-insight.tsx` (presentational card).

### 14. API Changes

None. No new route handlers or server actions; computation is read-time in
Server Components.

### 15. Database Changes

**None** in this change. (A future weights migration is sketched in §16.)

### 16. Migration Strategy (for the deferred weights change, if approved)

1. `alter type public.att_status add value 'early_exit';` (enum add is
   non-destructive).
2. New migration recreating `attendance_summary` with weights
   `present 1.0, late 0.75, early_exit 0.75, partial 0.5`.
3. Update `STATUS_WEIGHTS` in `lib/attendance.ts` + tests in lockstep.
4. Backfill: existing `partial` rows that were "left early with a late entry"
   are ambiguous — document that historical rows keep their current status.
5. Ship behind review because it changes every student's official %.

### 17. UI Components to Modify

Student dashboard, faculty performance table (done). No design-token changes —
reuses `Badge`, `GradeBadge`, `KpiCard`, `Card`, existing status colours.

### 18. New Components Needed

`PerformanceInsight` (server component; icon+label badges; theme/dark-mode
inherited from the token system).

### 19. Route Changes

None. Feature lives on existing `/student/dashboard` and
`/faculty/performance` routes.

### 20. Authentication Changes

None in this change (login rework deferred, §8).

### 21. Authorization Changes

None. Student sees only their own numbers (RLS-scoped reads already in the
page); faculty/admin already read all via existing policies.

### 22. Face Recognition Impact

**None.** The face workflow (enrolment, server-side match, blink liveness) is
untouched, per the "preserve unless explicitly required" rule.

### 23. Performance Considerations

Zero extra queries: the student dashboard already computes `pct` and
`avgMarksPct`; the insight reuses them. The faculty page reuses rows it
already builds. All logic is O(students) in memory.

### 24. Security Considerations

No new inputs, no new writes, no PII exposure. Inputs are clamped to `0..100`
so a stray value cannot skew a grade. No secrets, no console output.

### 25. Testing Strategy

Unit: 13 tests in `lib/performance.test.ts` (four spec quadrants, band
boundaries, null/insufficient-data, clamping, prediction risk/improvement,
failing projection). Integration/manual: see the feature's testing checklist
below. Regression: full `node --test lib/*.test.ts` stays green (44 tests);
`tsc --noEmit` and `next build` both pass.

---

## PHASE 2 — Architecture Review

**Strengths (keep as-is).** Modern `@supabase/ssr` 3-file split; SSR auth
guard via `getUser()` + role redirect; Postgres RLS as the final authority;
route groups + role dirs; **pure, unit-tested `lib/` domain modules**
(`attendance`, `results`, `face`, `geo`, `gps-settings`) with policy constants
in one place; three-layer CSS-variable design system; accessibility discipline
(state never by colour alone); parallelised Supabase reads.

**Observations / light recommendations (not applied — no gratuitous refactor).**

- The **weighted %** already halves late/partial in the SQL view but the TS
  `STATUS_WEIGHTS` is the source of truth for the app — if weights change,
  keep the two in lockstep (§16).
- Generated Supabase types would remove the manual `interface` per query and
  the `numeric`-as-string coercions; worth adopting when the schema stabilises.
- The faculty performance page recomputes attendance from raw `attendance` +
  session count rather than the `attendance_summary` view; fine for now, but
  the view is the more consistent denominator long-term.

The new module **follows the existing `lib/` convention exactly** (framework-
free, `import type` only, `.ts` extension imports for the node test runner,
policy constants exported), so it adds no new pattern to learn.

---

## PHASE 3 — Implementation Plan (this change)

| Task | Purpose | Files | Risk | Complexity | Testing |
|------|---------|-------|------|-----------|---------|
| 1. Performance logic | Quadrant feedback + prediction | `lib/performance.ts` | Low | M | 13 unit tests |
| 2. Unit tests | Lock the rubric to the spec examples | `lib/performance.test.ts` | Low | S | `node --test` |
| 3. Insight card | Present verdict, reuse tokens | `components/performance-insight.tsx` | Low | S | build + manual |
| 4. Student wiring | Show insight, reuse computed values | `app/student/dashboard/page.tsx` | Low | S | manual |
| 5. Faculty wiring | Intervention count + risk columns | `app/faculty/performance/page.tsx` | Low | S | manual |

Dependencies: task 1 → all others. No task touches auth, writes, schema, or
the face pipeline.

---

## PHASE 4 — What shipped

### Feature: AI-Based Attendance ↔ Performance Analysis + Prediction

**Summary.** The spec's "main thing": beyond showing attendance and marks,
analyse their relationship and give the student personalised, actionable
guidance plus a predicted grade, risk level, and improvement probability.

**Requirements covered.** Personalised feedback (four spec examples) ·
performance prediction (expected grade / risk / improvement / recommended
action) · faculty "students requiring intervention" report.

**Architecture impact.** Additive. One pure `lib/` module + one presentational
component wired into two existing pages. No schema, API, auth, or face change.

**Files.**
- `lib/performance.ts` — `analyzePerformance()`, `predictPerformance()`; reuses
  `gradeForPct` and `ELIGIBILITY_THRESHOLD`; `MARKS_GOOD_THRESHOLD` constant.
- `lib/performance.test.ts` — 13 tests.
- `components/performance-insight.tsx` — server component rendering the verdict.
- `app/student/dashboard/page.tsx` — insight card (reuses `pct`, `avgMarksPct`).
- `app/faculty/performance/page.tsx` — intervention KPI + Expected/Risk columns.

**Testing checklist.**
- [ ] Student with high attendance + high marks → "Excellent", Low risk.
- [ ] Low attendance + low marks → both-need-attention, High risk.
- [ ] High attendance + low marks → academics-need-focus, High improvement.
- [ ] Low attendance + high marks → attendance-at-risk, Medium improvement.
- [ ] New student with no marks → "not enough data" state, no crash.
- [ ] Faculty page shows correct intervention count and per-student risk.
- [ ] Dark mode + keyboard/AT: badges legible, state not colour-only.

**Potential risks.** The 70% "good marks" line is a tunable heuristic, not an
institutional policy — revisit if PES publishes a threshold. The prediction is
intentionally a transparent blend, not a trained model.

---

## Deliverables Summary

- **Architecture summary:** additive read-time module; no new patterns.
- **Files modified:** 2 pages; **files added:** 3 (logic, tests, component).
- **Database changes:** none. **Migration scripts:** none (weights migration
  sketched in §16, deferred).
- **Breaking changes:** none.
- **Deployment notes:** no env vars, no migration; deploy as a normal push.
- **Rollback plan:** revert the commit — no data or schema to unwind.
- **Future improvements:** apply spec attendance weights (§16) after sign-off;
  register-number/role-picker login; per-hour attendance grid; notification
  feed; correction-approval workflow; Excel/PDF export; per-course (not just
  overall) performance insight.
