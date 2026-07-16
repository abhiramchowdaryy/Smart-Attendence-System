# Starter-Repo Reference Notes

Reference patterns pulled from three current Next.js 15 / React 19 / Supabase
starters, compared against this codebase. **Nothing here has been applied to the
app** — these are recommendations to adopt selectively.

Starters reviewed:
- [`goldk3y/neo-starter`](https://github.com/goldk3y/neo-starter) — Next 15.5, React 19, Tailwind v4, Drizzle, generated Supabase types, next-themes
- [`benshapyro/nextjs-fullstack-starter`](https://github.com/benshapyro/nextjs-fullstack-starter) — Next 15.2, Tailwind v4, Supabase CLI (`config.toml`), `src/` layout, generated types
- [`dmuvaa/next-boilerplate`](https://github.com/dmuvaa/next-boilerplate) — Next 15.0, react-hook-form + zod, next-themes, Prisma

## What this app already does well (keep as-is)

- **Modern `@supabase/ssr` 3-file split** (`lib/supabase/{client,server,middleware}.ts`)
  — this is the current best-practice wiring. It is *better* than
  `nextjs-fullstack-starter`'s single `lib/supabase.ts`. No change needed.
- **SSR auth guard** — `getUser()` + role-based redirect in the server component.
- **Route groups + role dirs** — `(auth)`, `admin/`, `faculty/`, `student/`.
- **Design system via CSS variables** (`--pes-navy`, `--pes-orange`) with
  `darkMode: "class"`. More bespoke than any starter's default theme.

## Recommended adoptions (highest value first)

### 1. Generate typed Supabase schema — `types/supabase.ts`  ⭐ biggest win
Both `neo-starter` and `nextjs-fullstack-starter` commit generated DB types and
parameterize the client with them: `createClient<Database>()`. This app has
`supabase/schema.sql` but no generated types, so query results are untyped.

- Generate once and on every schema change:
  `npx supabase gen types typescript --project-id <ref> > types/supabase.ts`
  (or via the Supabase MCP `generate_typescript_types`).
- Then type each client, e.g. `createBrowserClient<Database>(...)`.
- Payoff: compile-time safety on every `.from("attendance").select(...)`.

### 2. Local dev + migrations via Supabase CLI — `supabase/config.toml`
`nextjs-fullstack-starter` ships a `supabase/` folder with `config.toml`, enabling
`supabase start` (local Postgres/Auth) and versioned migrations. This app applies
raw `schema.sql`/`seed.sql` by hand.

- `supabase init` → adds `config.toml`.
- Move `schema.sql` into `supabase/migrations/<timestamp>_init.sql`.
- Gives reproducible DB state, local testing, and CI-friendly migrations.

### 3. Typed form validation — react-hook-form + zod
`next-boilerplate` uses `react-hook-form` + `zod`. The login form and faculty
marks-entry form here are hand-wired. Adopting a `zod` schema per form gives:
- Client + server validation from one source of truth (`schema.parse`).
- Better error UX and fewer invalid writes to Supabase.
- Pairs naturally with the existing shadcn `components/ui` (add shadcn `form`).

### 4. `next-themes` for theme management (optional)
`neo-starter` and `next-boilerplate` use `next-themes` for system-preference
detection + persisted toggle. This app hand-rolls `darkMode: "class"`. Adopt only
if you want a user-facing light/dark toggle with `localStorage` persistence.

### 5. Tailwind v4 migration (optional, larger lift)
Two of three starters run Tailwind v4 (CSS-first `@theme`, no `tailwind.config`
JS). This app is on v3.4 with a rich `tailwind.config.ts`. Defer unless you want
the v4 build speed / CSS-variable ergonomics — the migration touches every token.

## Explicitly NOT adopted
- **Drizzle / Prisma ORMs** (neo-starter / next-boilerplate) — this app talks to
  Supabase directly via the JS client, which is the lighter, idiomatic choice here.
- **`src/` directory layout** (nextjs-fullstack-starter) — cosmetic; not worth the churn.

## ⚠️ Security note (unrelated to starters, found during review)
`/.env.example` currently contains full-length Supabase **anon** *and*
**`SUPABASE_SERVICE_ROLE_KEY`** JWTs. The service-role key is a full-access secret
and must never live in a committed file. If these are real, rotate them in the
Supabase dashboard and replace the values in `.env.example` with placeholders.
