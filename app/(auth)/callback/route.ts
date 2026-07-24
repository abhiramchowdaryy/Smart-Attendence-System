import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COLLEGE_EMAIL_DOMAIN,
  isCollegeEmail,
  ROLE_HOME,
  supabaseConfigured,
  type Role,
} from "@/lib/utils";

/**
 * Google OAuth callback. Supabase redirects here with a `code` after the
 * student authorises with their college Google account. We exchange the code
 * for a session, then enforce two rules that Google's `hd` hint alone cannot
 * guarantee:
 *
 *   1. The address must be on the college Workspace domain (COLLEGE_EMAIL_DOMAIN).
 *   2. Google sign-in is for **students** only — faculty and admin use a
 *      password, so any non-student account is rejected here.
 *
 * On any failure we sign the user back out and bounce to /login with a message.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  const bounce = (message: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  };

  if (!supabaseConfigured()) {
    return bounce("Supabase is not configured.");
  }
  if (oauthError) {
    return bounce(oauthError);
  }
  if (!code) {
    return bounce("Sign-in was cancelled before it completed.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return bounce(error?.message ?? "Could not complete Google sign-in.");
  }

  const user = data.user;

  // Rule 1 — must be a college Google account.
  if (!isCollegeEmail(user.email)) {
    await supabase.auth.signOut();
    return bounce(
      `Please sign in with your college Google account (@${COLLEGE_EMAIL_DOMAIN}).`
    );
  }

  // Rule 2 — Google sign-in is for students only. A brand-new account is
  // created by the on_auth_user_created trigger with role 'student'.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as Role) ?? "student";
  if (role !== "student") {
    await supabase.auth.signOut();
    return bounce(
      "Google sign-in is for students only. Faculty and admin sign in with a password."
    );
  }

  return NextResponse.redirect(new URL(ROLE_HOME.student, origin));
}
