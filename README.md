# PES Smart Attendance

Smart Attendance Management System with Facial Recognition and Performance
Analytics — PES University, Phase 1.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS ·
Supabase (Postgres + Auth + RLS) · @vladmandic/face-api (browser face
detection) · Geolocation + Haversine geofencing · Framer Motion ·
TanStack Query + Zustand. All free-tier.

## What works in this MVP slice

| Flow | Status |
|------|--------|
| Email/password + magic-link sign-in, role-based redirect | ✅ |
| Role-guarded sections (student / faculty / admin) + Postgres RLS | ✅ |
| Student dashboard — live KPIs from Supabase (today, %, avg duration) | ✅ |
| **Mark Attendance** — live camera face detection + geofence chip → entry/exit with timestamps, duration, late/partial status | ✅ |
| Faculty dashboard — open/close sessions, live roster (15s polling), today's KPIs | ✅ |
| Admin dashboard — users & roles table, geofence CRUD, KPIs, 7-day status chart | ✅ |
| Marks entry (`/faculty/marks`) + attendance ↔ performance correlation (`/faculty/performance`) | ✅ |
| Server-side DeepFace verification, Twilio SMS, PostGIS, Realtime, map editor, CSV/PDF export | Phase 2 (seams in place) |

## Setup (≈10 minutes)

### 1. Install dependencies

```bash
npm install
npm run download-models   # fetches face-api TinyFaceDetector into public/models
```

### 2. Create the free Supabase project

1. [supabase.com](https://supabase.com) → New project (free tier).
2. SQL Editor → paste **`supabase/schema.sql`** → Run.
3. Open **`supabase/seed.sql`**, **edit the geofence lat/lng to your current
   location** (Google Maps → right-click → copy coordinates), then run it.

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

Sign in with the user you created → you land on the student dashboard →
**Mark Attendance**. Camera + location permissions are requested; the
button enables only when a face is stably detected **and** you are inside
the geofence. Marking after 10 minutes records **Late**; exiting while the
session is open records **Left early (partial)**.

> Camera and geolocation require a secure context: `localhost` works;
> on a phone use the Vercel deployment (HTTPS).

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
  student/               dashboard (KPIs) · mark-attendance (face + geo)
  faculty/  admin/       role-guarded Phase-2 stubs
  api/face/verify/       seam for the Python DeepFace service (501 until set)
components/
  ui/                    button, card, input, label, badge, skeleton
  attendance/            FaceCapture, GeofenceIndicator, MarkAttendanceClient
  app-shell, kpi-card, status-pill, theme-toggle, coming-soon
hooks/use-geofence.ts    live Haversine geofence state (UX only)
lib/                     supabase clients (browser/server/middleware), geo, auth
supabase/                schema.sql (tables + RLS) · seed.sql (demo data)
scripts/download-models.mjs
```

## Security model (defense in depth)

1. **Middleware** — unauthenticated users never reach app routes.
2. **Section layouts** — `requireRole()` redirects mismatched roles.
3. **Server actions** — geofence distance is **re-computed server-side**;
   the browser hook is presentation only.
4. **Postgres RLS** — students can only read/write their own rows; only
   staff touch marks; users cannot self-promote their role.

Known Phase-1 limitation (by design, documented for the report): face
*identity* matching happens in Phase 2 via the DeepFace service — Phase 1
gates on stable face *detection* confidence, which prevents "no face at
all" but not a determined photo spoof. Geofence + per-session uniqueness
are the active anti-proxy layers meanwhile.

## Phase-2 roadmap

Faculty sessions, marks upload, admin user management, and the attendance ↔
performance correlation charts have all landed — see the table above. What is
still outstanding:

- Python FastAPI + DeepFace verification on Render (seam: `FACE_SERVICE_URL`;
  enrolled descriptor column: `profiles.face_embedding`)
- Twilio parent SMS via Supabase Edge Function (target: `profiles.parent_phone`;
  note: SMS to Indian numbers needs TRAI/DLT sender + template registration)
- Supabase Realtime to replace the faculty roster's 15s polling
  (`components/faculty/auto-refresh.tsx`)
- Map-pin geofence editor (admin currently types lat/lng or uses "Use my
  current location")
- PostGIS `ST_DWithin` geofencing (currently Haversine in SQL/TS)
- CSV / PDF export

---
Team: Preethika.C · Preethi · Nesara · Monisha — Guide: Prof. Niteesh K R
