import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveOrigin } from "@/lib/origin";
import { isCollegeEmail, ROLE_HOME, supabaseConfigured, type Role } from "@/lib/utils";
import type { LoginErrorCode } from "../login/login-errors";

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
 * On any failure we sign the user back out and bounce to /login with a stable
 * error *code* (never raw provider text — see login-errors.ts).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  // Proxy-aware origin, consistent with the redirectTo used to start the flow.
  const origin = resolveOrigin(request.headers, request.url);

  const bounce = (errorCode: LoginErrorCode) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", errorCode);
    return NextResponse.redirect(url);
  };

  if (!supabaseConfigured()) {
    return bounce("config");
  }
  if (oauthError) {
    return bounce("oauth");
  }
  if (!code) {
    return bounce("cancelled");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return bounce("oauth");
  }

  const user = data.user;

  // Rule 1 — must be a college Google account.
  if (!isCollegeEmail(user.email)) {
    await supabase.auth.signOut();
    return bounce("domain");
  }

  // Rule 2 — Google sign-in is for students only. A brand-new account is
  // created by the on_auth_user_created trigger with role 'student', so the
  // row is present here. Fail *closed*: if we can't read/confirm the role,
  // sign out rather than assuming student.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    return bounce("oauth");
  }
  if ((profile.role as Role) !== "student") {
    await supabase.auth.signOut();
    return bounce("not_student");
  }

  return NextResponse.redirect(new URL(ROLE_HOME.student, origin));
}
