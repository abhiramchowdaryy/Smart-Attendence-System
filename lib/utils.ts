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

export type Role = "student" | "faculty" | "admin";
export type AttendanceStatus = "present" | "late" | "absent" | "partial";

export const ROLE_HOME: Record<Role, string> = {
  student: "/student/dashboard",
  faculty: "/faculty/dashboard",
  admin: "/admin/dashboard",
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
