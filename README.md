# PES Smart Attendance

Smart Attendance Management System with Facial Recognition and Performance
Analytics for PES University.

**Stack:** React 19 + Vite 6 · React Router 6 · TypeScript · Tailwind CSS ·
Supabase (Postgres + PostGIS + Auth + RLS + Realtime + Edge Functions) ·
@vladmandic/face-api (browser face detection) · Geolocation + PostGIS
`ST_DWithin` geofencing (Haversine fallback) · OpenStreetMap map-pin editor ·
CSV / PDF export · Framer Motion · TanStack Query + Zustand. All free-tier.

## What this project does

A React + Vite attendance system backed by Supabase. It supports:

- Student Google login for the college domain `@pesu.pes.edu`.
- Faculty/admin email-password login with role-based routing.
- Face enrolment with blink liveness and live attendance verification.
- Geofence-based attendance marking and student/faculty/admin dashboards.
- Parent view via the student's own login on `/parent-login`.
- Supabase Postgres, RLS, Realtime, Edge Functions, and optional server-side face embedding.

## Setup (≈10 minutes)

### 1. Install dependencies

```bash
npm install
npm run download-models   # detector + landmarks + recognition nets → public/models
```

### 2. Create the free Supabase project

1. [supabase.com](https://supabase.com) → New project (free tier).
2. SQL Editor → paste **`supabase/schema.sql`** → Run.
3. Run each file in **`supabase/migrations/`** in order (0001 → 0009):
   courses + enrolments, attendance summary view, GPS settings,
   student details, face-enrolment flag, server-side face embedding,
   PostGIS geofencing, Realtime publication, SMS notification log.
   (0007 enables the PostGIS extension; if your project can't, the app
   falls back to the built-in Haversine check automatically.)
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

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from
Project Settings → API Keys. New projects issue `sb_publishable_...` keys;
older ones issue a legacy `eyJ...` anon JWT. Either works — take whichever
your project shows. Vite only exposes variables prefixed with `VITE_` to the
browser bundle.

### 4. Create users

Nothing signs in until at least one user exists. Two ways:

**A. Supabase Dashboard (no extra key needed).** Authentication → Users →
**Add user**, enable *Auto Confirm User*. The signup trigger creates the
matching `profiles` row with `role = 'student'`. To make a faculty or admin
account, promote it in the SQL Editor:

```sql
update public.profiles set role = 'faculty' where id =
  (select id from auth.users where email = 'faculty@pesu.pes.edu');
```

> **Parents need no account of their own.** A parent signs in at
> `/parent-login` with their **child's own student email + password** and lands
> on a read-only parent dashboard for that student — reached from the "Sign in
> as a parent" link on the login page.

**B. Seed script (scripted, needs the secret key).** Add
`SUPABASE_SERVICE_ROLE_KEY` to `.env.local` — Project Settings → API Keys →
the **secret** key (`sb_secret_...`, or a legacy `service_role` JWT on older
projects). It bypasses RLS, so keep it out of git and never prefix it with
`VITE_` (it must stay out of the browser bundle). Then:

```bash
npm run seed-users   # student@pesu.pes.edu / faculty@pesu.pes.edu / admin@pesu.pes.edu — Pes@12345
```

### 5. Enable Google sign-in (students)

Students sign in with their college Google account — no password. Turn the
provider on once per project:

1. **Google Cloud Console** → *APIs & Services → Credentials* → create an
   **OAuth 2.0 Client ID** (type *Web application*). Under *Authorized redirect
   URIs* add your Supabase callback:
   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
2. **Supabase Dashboard** → *Authentication → Providers → Google* → paste the
   Client ID + Secret and enable it.
3. **Supabase Dashboard** → *Authentication → URL Configuration* → add
   `http://localhost:3000/auth/callback` (and your deployed
   `https://…/auth/callback`) to **Redirect URLs**.

Only `@pesu.pes.edu` accounts are accepted, and Google sign-in creates/uses
**student** accounts only — the `/callback` handler rejects any other domain or
role. Faculty and admin keep signing in with email + password (step 4). To use a
different Workspace domain, set `VITE_COLLEGE_DOMAIN` in `.env.local`.

### 6. Run

```bash
npm run dev
```

The Vite dev server runs on `http://localhost:3000`.

Keep this terminal visible. If the dev server stops, an already-open tab
still renders the page but every sign-in fails with a misleading
`TypeError: Failed to fetch` — that just means the POST hit a dead port.

### Face enrollment troubleshooting

- If the camera view shows **Face models missing**, run `npm run download-models`
  and reload.
- Allow camera access in the browser and keep your face centered in the
  oval.
- Blink once clearly, then hold still until the scanner turns green.
- If `Save my face` stays disabled, keep the frame steady and wait for the
  `Ready` status; the button only activates after a high-quality live frame.
- If saving still fails, open the browser console and check that your user has
  a `profiles` row in Supabase with `face_embedding` available.

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
remembered by a `localStorage` flag (`pes-parent-view`) and cleared on sign-out.

## Deploy (free)

This is a static Vite SPA (`npm run build` → `dist/`).

1. Push this folder to a GitHub repo.
2. [vercel.com](https://vercel.com) (or Netlify/Cloudflare Pages) → Import repo.
   Framework preset **Vite**; build command `npm run build`; output `dist`.
   Add the two `VITE_SUPABASE_*` env vars (and `VITE_COLLEGE_DOMAIN` if you use
   a non-default domain) → Deploy.
3. Add a SPA rewrite so client-side routes resolve (all paths → `/index.html`):
   Vercel does this automatically for the Vite preset; on other hosts add the
   catch-all rewrite.
4. Every PR gets a preview URL; `main` auto-deploys to production.
5. Install on a phone: open the site → browser menu → *Add to Home Screen*
   (PWA manifest included).

## Project structure

```
index.html               Vite entry — mounts src/main.tsx
src/
  main.tsx               createRoot + Providers + RouterProvider
  router.tsx             React Router route tree (createBrowserRouter)
  providers.tsx          Helmet + TanStack Query + AuthProvider
  guards.tsx             RequireRole / RequireParentView route guards
  routes/                root-redirect · auth-callback (Google OAuth handler)
app/                     route components (client), grouped by role:
  (auth)/login/          sign-in (student Google OAuth + faculty/admin password)
  (auth)/parent-login/   parent sign-in — uses the student's own login (see below)
  student/               dashboard · attendance (75% engine) · results (SGPA/CGPA)
                         mark-attendance (face match + geo) · enroll-face · profile
  parent/                read-only dashboard of a child's attendance & marks
  faculty/               dashboard · attendance report · courses & rosters · marks
  admin/                 dashboard · attendance rollup · GPS settings
                         (each folder's actions.ts holds its client data mutations)
components/
  ui/                    button, card, input, label, badge, skeleton
  attendance/            GeofenceIndicator, MarkAttendanceClient
  face/                  BiometricScanner (blink liveness + match), FaceEnrollment
  charts/                AttendanceRing, GradeDial, DurationBars, …
  eligibility-badge, grade-badge, app-shell, kpi-card, status-pill, …
hooks/use-geofence.ts    live Haversine geofence state (UX only)
lib/                     attendance (75% policy) · results (grades/GPA) · face
                         (match + EAR liveness math) · gps-settings · geo ·
                         geofence (PostGIS RPC + Haversine fallback) ·
                         webmercator (map math) · export (CSV/PDF) · sms
                         (phone + template) · auth — each with node --test units
supabase/                schema.sql · migrations/0001–0009 · seed*.sql
  functions/             edge functions (Deno): notify-shortfall (Twilio parent
                         SMS) · face-represent + face-verify (DeepFace proxy,
                         holds FACE_SERVICE_URL/TOKEN) + _shared/
face-service/            optional FastAPI + DeepFace microservice (server-side
                         verification) — Dockerfile + Render blueprint + tests
docs/                    attendance-aggregation-engine design + implementation
                         plan · STARTER_REFERENCE.md
scripts/download-models.mjs
```

Run the unit tests with `node --test lib/*.test.ts` (Node ≥ 22.18, no
framework needed).

## Security model (defense in depth)

1. **Route guards** — `RequireRole` / `RequireParentView` (React Router)
   keep unauthenticated users and mismatched roles out of app routes.
2. **Postgres RLS is the real gate** — every read/write goes through the
   browser Supabase client under the signed-in user's JWT, so RLS is the
   authoritative enforcement: students can only read/write their own rows;
   only staff touch marks/courses/settings; users cannot self-promote. The
   client-side role checks are UX, not security.
3. **Face identity match** — the live descriptor is matched against the
   enrolled descriptor before insert; with server verification enabled the
   live *image* is re-embedded by the `face-verify` edge function (below).
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
who can forge WebRTC frames could bypass it. Enabling the server-side path
closes this: the browser then sends the **image** to the `face-verify` edge
function, which proxies to the DeepFace service (`face-service/`) and computes
the embedding on the server, so the client can no longer assert an identity the
server never saw pixels for. The `FACE_SERVICE_URL`/`FACE_SERVICE_TOKEN`
secrets live only in the edge function — never in the browser bundle.
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
2. Deploy the proxy edge functions and set their secrets (the token never
   touches the browser):

   ```bash
   supabase functions deploy face-represent face-verify
   supabase secrets set FACE_SERVICE_URL=https://your-face-service \
                        FACE_SERVICE_TOKEN=your-shared-secret
   ```
3. Flip the public feature flag on so the app uses the server-side path:
   set `VITE_FACE_VERIFICATION=true` in the app's environment and rebuild.
4. Apply migration `0006_face_embedding_server.sql`.
5. Students re-enrol once so a server embedding is captured; from then on the
   authoritative check runs on server-side pixels.

Team: Preethika.C · Preethi · Nesara · Monisha — Guide: Prof. Niteesh K R


