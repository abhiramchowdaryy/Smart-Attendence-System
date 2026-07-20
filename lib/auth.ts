import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/redirect";
import { ROLE_HOME, supabaseConfigured, type Role } from "@/lib/utils";

export interface SessionProfile {
  id: string;
  fullName: string;
  rollNo: string | null;
  role: Role;
}

/**
 * Sends a signed-in user to `next` when it is a safe in-app path they are
 * allowed to reach, otherwise to their role's landing page. Never returns.
 */
export async function redirectToRoleHome(
  supabase: SupabaseClient,
  userId: string,
  next?: string | null
): Promise<never> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const role = (profile?.role as Role) ?? "student";

  // Honour the original destination only if this role owns that section —
  // otherwise the section layout would just bounce them again.
  const target = safeRedirectPath(next);
  if (target) {
    const ownsSection =
      target.startsWith(`/${role}/`) ||
      // Faculty pages are shared with admin (see the shell's nav).
      (role === "admin" && target.startsWith("/faculty/"));
    if (ownsSection) redirect(target);
  }

  redirect(ROLE_HOME[role]);
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
