import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, supabaseConfigured, type Role } from "@/lib/utils";

/** Set by signInAsParent; gates the read-only /parent section. */
const PARENT_VIEW_COOKIE = "parent_view";

export interface SessionProfile {
  id: string;
  fullName: string;
  rollNo: string | null;
  role: Role;
}

/** Sends a signed-in user to their role's landing page. Never returns. */
export async function redirectToRoleHome(
  supabase: SupabaseClient,
  userId: string
): Promise<never> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  redirect(ROLE_HOME[(profile?.role as Role) ?? "student"]);
}

/**
 * Server-side role gate used by each section layout. Redirects to /login
 * when unauthenticated and to the user's own home when the role doesn't
 * match. Postgres RLS remains the final enforcement layer under this.
 */
export async function requireRole(allowed: Role[]): Promise<SessionProfile> {
  if (!supabaseConfigured()) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, roll_no, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as Role;
  if (!allowed.includes(role)) redirect(ROLE_HOME[role]);

  return {
    id: profile.id,
    fullName: profile.full_name,
    rollNo: profile.roll_no,
    role,
  };
}

/**
 * Gate for the read-only /parent section. A "parent" is not a stored role —
 * it is a student account signed in through the parent page (signInAsParent),
 * remembered by the parent_view cookie. This verifies that cookie is set and
 * that the signed-in account is genuinely a student, then returns the
 * student's own profile as the child being viewed.
 */
export async function requireParentView(): Promise<SessionProfile> {
  if (!supabaseConfigured()) redirect("/parent-login");

  const store = await cookies();
  if (store.get(PARENT_VIEW_COOKIE)?.value !== "1") redirect("/parent-login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/parent-login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, roll_no, role")
    .eq("id", user.id)
    .single();

  // Parent mode is only meaningful over a student account.
  if (!profile || (profile.role as Role) !== "student") {
    redirect("/parent-login");
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    rollNo: profile.roll_no,
    role: "parent",
  };
}
