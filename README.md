# PES Smart Attendance

Smart Attendance Management System with Facial Recognition and Performance
Analytics — PES University. Phase 1 (MVP) + Phase 2 (attendance engine,
face identity + liveness, GPS policy, results, rich profile).

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS ·
Supabase (Postgres + Auth + RLS) · @vladmandic/face-api (browser face
detection) · Geolocation + Haversine geofencing · Framer Motion ·
TanStack Query + Zustand. All free-tier.

## What works in this MVP slice

| Flow | Status |
|------|--------|
| Email/password + magic-link sign-in, role-based redirect | ✅ |
| Role-guarded sections (student / faculty / admin) + Postgres RLS | ✅ |
| **Parent login** (`/parent-login`) — read-only view of a child's attendance & marks, using the student's own login | ✅ |
| Student dashboard — live KPIs from Supabase (today, %, avg duration) | ✅ |
| **Mark Attendance** — live camera face detection + geofence chip → entry/exit with timestamps, duration, late/partial status | ✅ |
| Faculty dashboard — open/close sessions, live roster (15s polling), today's KPIs | ✅ |
| Admin dashboard — users & roles table, geofence CRUD, KPIs, 7-day status chart | ✅ |
| Marks entry (`/faculty/marks`) + attendance ↔ performance correlation (`/faculty/performance`) | ✅ |
| **My Attendance** — per-subject attended/conducted, official + weighted %, 75% eligibility badges, semester filter | ✅ Phase 2 |
| Faculty course report + admin institution rollup (worst-first, shortfall flags) | ✅ Phase 2 |
| Courses & enrolment management (`/faculty/courses`) — catalogue CRUD + roster editor | ✅ Phase 2 |
| **Face enrolment + identity verification** — 128-d descriptor, server-side match, blink liveness | ✅ Phase 2 |
| **GPS settings** (`/admin/settings`) — geofence grace, late window, high-accuracy toggle | ✅ Phase 2 |
| **Results** — ISA/ESA marks, letter grades, SGPA/CGPA dials | ✅ Phase 2 |
| **Profile** — personal/family/address details, masked Aadhaar (last 4 only) | ✅ Phase 2 |
| **DeepFace server verification** — optional FastAPI service; live *image* re-embedded server-side (`FACE_SERVICE_URL`) | ✅ Phase 2+ (opt-in) |
| Twilio SMS, PostGIS, Realtime, map editor, CSV/PDF export | Later (seams in place) |

## Setup (≈10 minutes)

### 1. Install dependencies

```bash
npm install
npm run download-models   # detector + landmarks + recognition nets → public/models
```

### 2. Create the free Supabase project

1. [supabase.com](https://supabase.com) → New project (free tier).
2. SQL Editor → paste **`supabase/schema.sql`** → Run.
3. Run each file in **`supabase/migrations/`** in order (0001 → 0006):
   courses + enrolments, attendance summary view, GPS settings,
   student details, face-enrolment flag, server-side face embedding.
4. Open **`supabase/seed.sql`**, **edit the geofence lat/lng to your current
   location** (Google Maps → right-click → copy coordinates), then run it.
5. After creating users (step 4 below), run **`supabase/seed_phase2.sql`**
   (demo courses, enrolments, attendance history) and
   **`supabase/seed_phase3.sql`** (demo marks + profile details) so the
   attendance, results and profile pages are populated.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
Project Settings → API Keys. New projects issue `sb_publishable_...` keys;
older ones issue a legacy `eyJ...` anon JWT. Either works — take whichever
your project shows.

### 4. Create users

Nothing signs in until at least one user exists. Two ways:

**A. Supabase Dashboard (no extra key needed).** Authentication → Users →
**Add user**, enable *Auto Confirm User*. The signup trigger creates the
matching `profiles` row with `role = 'student'`. To make a faculty or admin
account, promote it in the SQL Editor:

```sql
update public.profiles set role = 'faculty' where id =
  (select id from auth.users where email = 'faculty@pes.edu');
```

> **Parents need no account of their own.** A parent signs in at
> `/parent-login` with their **child's own student email + password** and lands
> on a read-only parent dashboard for that student — reached from the "Sign in
> as a parent" link on the login page.

**B. Seed script (scripted, needs the secret key).** Add
`SUPABASE_SERVICE_ROLE_KEY` to `.env.local` — Project Settings → API Keys →
the **secret** key (`sb_secret_...`, or a legacy `service_role` JWT on older
projects). It bypasses RLS, so keep it out of git and never prefix it with
`NEXT_PUBLIC_`. Then:

```bash
npm run seed-users   # student@pes.edu / faculty@pes.edu / admin@pes.edu — Pes@12345
```

### 5. Run

```bash
npm run dev
```

Keep this terminal visible. If the dev server stops, an already-open tab
still renders the page but every sign-in fails with a misleading
`TypeError: Failed to fetch` — that just means the POST hit a dead port.

Sign in with the user you created → student dashboard. First visit
**Enrol Face** (blink once, hold still, save). Then **Mark Attendance**:
the button enables only when your live face **matches your enrolment**
(with a blink liveness check) **and** you are inside the geofence. Late
window and geofence grace are admin-tunable at `/admin/settings`.
Exiting while the session is open records **Left early (partial)**.

> Camera and geolocation require a secure context: `localhost` works;
> on a phone use the Vercel deployment (HTTPS).

**Parent sign-in.** From the login page, tap **Sign in as a parent** (or open
`/parent-login`) and enter the **student's own email and password** — there is
no separate parent account. That lands on a read-only parent dashboard showing
the child's attendance rate, marks and recent classes. "Parent mode" is
remembered by an `httpOnly` cookie and cleared on sign-out.

## Deploy (free)

1. Push this folder to a GitHub repo.
2. [vercel.com](https://vercel.com) → Import repo → add the two
   `NEXT_PUBLIC_SUPABASE_*` env vars → Deploy.
3. Every PR gets a preview URL; `main` auto-deploys to production.
4. Install on a phone: open the site → browser menu → *Add to Home Screen*
   (PWA manifest included).

## Project structure

```
app/
  (auth)/login/          sign-in (password + magic link, server actions)
  (auth)/parent-login/   parent sign-in — uses the student's own login (see below)
  student/               dashboard · attendance (75% engine) · results (SGPA/CGPA)
                         mark-attendance (face match + geo) · enroll-face · profile
  parent/                read-only dashboard of a child's attendance & marks
  faculty/               dashboard · attendance report · courses & rosters · marks
  admin/                 dashboard · attendance rollup · GPS settings
  api/face/verify/       HTTP seam to the DeepFace service (501 until FACE_SERVICE_URL set)
components/
  ui/                    button, card, input, label, badge, skeleton
  attendance/            GeofenceIndicator, MarkAttendanceClient
  face/                  BiometricScanner (blink liveness + match), FaceEnrollment
  charts/                AttendanceRing, GradeDial, DurationBars, …
  eligibility-badge, grade-badge, app-shell, kpi-card, status-pill, …
hooks/use-geofence.ts    live Haversine geofence state (UX only)
lib/                     attendance (75% policy) · results (grades/GPA) · face
                         (match + EAR liveness math) · gps-settings · geo · auth
                         — each with node --test unit tests
supabase/                schema.sql · migrations/0001–0006 · seed*.sql
face-service/            optional FastAPI + DeepFace microservice (server-side
                         verification) — Dockerfile + Render blueprint + tests
docs/                    attendance-aggregation-engine design + implementation
                         plan · STARTER_REFERENCE.md
scripts/download-models.mjs
```

Run the unit tests with `node --test lib/*.test.ts` (Node ≥ 22.18, no
framework needed).

## Security model (defense in depth)

1. **Middleware** — unauthenticated users never reach app routes.
2. **Section layouts** — `requireRole()` redirects mismatched roles.
3. **Server actions** — geofence distance **and the face identity match**
   are re-computed server-side (live descriptor vs enrolled descriptor);
   the browser UI is presentation only.
4. **Postgres RLS** — students can only read/write their own rows; only
   staff touch marks/courses/settings; users cannot self-promote.
5. **Liveness** — a blink (eye-aspect-ratio transition) is required before
   any face is accepted, defeating a static held-up photo.
6. **First-write-only face enrolment** — `profiles.face_embedding` can be
   written once and never silently overwritten (the update is guarded by
   `.is("face_embedding", null)`, so concurrent submits cannot race it).
   Without this the identity anchor is self-serve: anyone holding an
   unlocked session could re-enrol their own face and pass every later
   check by construction. Replacing an enrolment is an admin action
   (**Reset** in the admin users table), which keeps a human at the point
   where trust is established.

Known limitation (documented for the report): in the **default** build the
*live descriptor* is produced in the browser, so a sophisticated attacker
who can forge WebRTC frames could bypass it. Setting `FACE_SERVICE_URL`
closes this: the browser then sends the **image**, and the embedding is
computed on the server by the DeepFace service (`face-service/`), so the
client can no longer assert an identity the server never saw pixels for.
Enrolment stores a server-computed embedding
(`profiles.face_embedding_server`); mark-attendance re-embeds the live frame
and compares. Students enrolled before the service was turned on keep working
on the descriptor match until they re-enrol (non-breaking fallback).
Geofence + per-session uniqueness + blink liveness are the active anti-proxy
layers either way. Face matching needs a real camera — it cannot be exercised
in headless CI.

### Enabling server-side DeepFace verification (optional)

1. Run or deploy the Python service in [`face-service/`](face-service/README.md)
   (FastAPI + DeepFace; free-tier Render blueprint included).
2. Set `FACE_SERVICE_URL` (and `FACE_SERVICE_TOKEN`, matching the service) in
   the Next.js app's environment.
3. Apply migration `0006_face_embedding_server.sql`.
4. Students re-enrol once so a server embedding is captured; from then on the
   authoritative check runs on server-side pixels.

## Roadmap (remaining)

Phase 2 has landed: the 75% attendance engine, face enrolment + server-side
identity match with blink liveness, admin GPS policy, results (grades,
SGPA/CGPA), rich profile, and course/enrolment management — see the table
above. Still outstanding:

- Twilio parent SMS via Supabase Edge Function (target: `profiles.parent_phone`;
  note: SMS to Indian numbers needs TRAI/DLT sender + template registration) —
  wire to the attendance-shortfall flags
- Supabase Realtime to replace the faculty roster's 15s polling
  (`components/faculty/auto-refresh.tsx`)
- Map-pin geofence editor (admin currently types lat/lng or uses "Use my
  current location")
- PostGIS `ST_DWithin` geofencing (currently Haversine in SQL/TS)
- CSV / PDF export of attendance and results

---
Team: Preethika.C · Preethi · Nesara · Monisha — Guide: Prof. Niteesh K R
