/**
 * Creates confirmed demo users for local testing / the Phase-1 demo:
 *
 *   student@pesu.pesu.pes.edu  / Pes@12345   (role: student)
 *   faculty@pesu.pesu.pes.edu  / Pes@12345   (role: faculty)
 *   admin@pesu.pesu.pes.edu    / Pes@12345   (role: admin)
 *
 * Parent sign-in needs no separate account: a parent signs in on
 * /parent-login with the student's own email + password (student@pesu.pesu.pes.edu).
 *
 * Uses the service-role key from .env.local (server-side only — never
 * ship this key to the browser). Safe to re-run: existing users are
 * skipped, roles are re-asserted.
 *
 *   npm run seed-users
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

// Minimal .env.local parser (no dotenv dependency needed).
function loadEnvLocal() {
  const file = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of file.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnvLocal();
const url = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// The .env.example placeholder reaches Supabase as a real request and comes
// back as a bare "Invalid API key", which reads like a key problem rather than
// a setup step that was never done. Catch it here instead.
if (/^(your-|<|changeme)/i.test(serviceKey)) {
  console.error(
    `SUPABASE_SERVICE_ROLE_KEY in .env.local is still the placeholder ("${serviceKey}").\n\n` +
      "Get the real key from Supabase → Project Settings → API Keys.\n" +
      "This project's anon key is a new-style 'sb_publishable_...' key, so take\n" +
      "the matching secret key ('sb_secret_...'), not a legacy 'eyJ...' JWT."
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  { email: "student@pesu.pesu.pes.edu", fullName: "Demo Student", role: "student", rollNo: "PES1UG24CA001" },
  { email: "faculty@pesu.pesu.pes.edu", fullName: "Demo Faculty", role: "faculty", rollNo: null },
  { email: "admin@pesu.pesu.pes.edu", fullName: "Demo Admin", role: "admin", rollNo: null },
];
const PASSWORD = "Pes@12345";

for (const u of USERS) {
  process.stdout.write(`${u.email} (${u.role}) ... `);

  // Create (or find existing) auth user — confirmed, no email round-trip.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: u.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: u.fullName },
  });

  let userId = created?.user?.id;
  if (createError) {
    if (/already.*(registered|exists)/i.test(createError.message)) {
      const { data: list } = await admin.auth.admin.listUsers();
      userId = list?.users.find((x) => x.email === u.email)?.id;
      if (!userId) {
        console.log(`FAILED — exists but not found: ${createError.message}`);
        continue;
      }
      process.stdout.write("already exists, updating role ... ");
    } else {
      console.log(`FAILED — ${createError.message}`);
      if (/Database error/i.test(createError.message)) {
        console.error(
          "\nHint: this usually means supabase/schema.sql (profiles table + signup trigger) has not been run yet. Run it in the Supabase SQL Editor first."
        );
      }
      continue;
    }
  }

  // Assert profile fields (service role bypasses RLS).
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: u.fullName, role: u.role, roll_no: u.rollNo })
    .eq("id", userId);

  console.log(profileError ? `profile FAILED — ${profileError.message}` : "ok");
}

console.log(`\nDone. Password for all demo users: ${PASSWORD}`);

