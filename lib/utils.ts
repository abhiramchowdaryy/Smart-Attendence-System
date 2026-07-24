import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when both Supabase public env vars are present (app can run in "unconfigured" demo state without them). */
export function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Application roles. `student`/`faculty`/`admin` are the real Postgres
 * `user_role` enum values stored on `profiles`. `parent` is NOT a DB role —
 * it is a read-only *view mode* of a student account: a parent signs in on
 * the parent page with their child's own student email + password, and the
 * app remembers "parent mode" via a cookie (see signInAsParent). It appears
 * in this union only so the shell nav and routing can treat it as a role.
 */
export type Role = "student" | "faculty" | "admin" | "parent";
export type AttendanceStatus = "present" | "late" | "absent" | "partial";

export const ROLE_HOME: Record<Role, string> = {
  student: "/student/dashboard",
  faculty: "/faculty/dashboard",
  admin: "/admin/dashboard",
  parent: "/parent/dashboard",
};

/**
 * Minimum face-detection score accepted for an entry. The camera gate and
 * the server action must agree on this — the server re-checks it, so a
 * drift between the two would silently reject valid captures.
 */
export const FACE_CONFIDENCE_MIN = 0.8;

/**
 * Supabase returns an embedded relation as an object or a single-element
 * array depending on how it infers the join, so callers must unwrap both.
 */
export function firstRow<T>(embed: T | T[] | null): T | null {
  if (Array.isArray(embed)) return embed[0] ?? null;
  return embed ?? null;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
