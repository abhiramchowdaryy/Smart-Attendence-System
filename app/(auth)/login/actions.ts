"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirectToRoleHome } from "@/lib/auth";
import { resolveOrigin } from "@/lib/origin";
import { COLLEGE_EMAIL_DOMAIN, supabaseConfigured } from "@/lib/utils";

export interface AuthFormState {
  error?: string;
}

const NOT_CONFIGURED =
  "Supabase is not configured. Copy .env.example to .env.local and add your project credentials.";

/**
 * Cookie that marks the current session as being viewed in "parent mode".
 * A parent uses the *student's* own credentials (there is no separate parent
 * account), so the only thing distinguishing a parent from the student is
 * which page they signed in on — this cookie remembers that choice and gates
 * the read-only /parent section.
 */
const PARENT_VIEW_COOKIE = "parent_view";

async function setParentView(on: boolean) {
  const store = await cookies();
  if (on) {
    store.set(PARENT_VIEW_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    store.delete(PARENT_VIEW_COOKIE);
  }
}

/** Email + password sign-in → redirect to the user's role home. */
export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter both email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  // A normal sign-in is the full account, not parent mode — clear any stale flag.
  await setParentView(false);
  revalidatePath("/", "layout");
  return redirectToRoleHome(supabase, data.user.id);
}

/**
 * Parent sign-in. The parent enters their child's *student* email + password
 * (the same account the student uses) and lands on the read-only parent
 * dashboard for that student. Only student accounts can be viewed this way.
 */
export async function signInAsParent(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your child's student email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  // Parent view is a lens over a student account — reject faculty/admin logins.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "student") {
    await supabase.auth.signOut();
    return {
      error:
        "Parent sign-in works only with a student account's email and password.",
    };
  }

  await setParentView(true);
  revalidatePath("/", "layout");
  redirect("/parent/dashboard");
}

/**
 * Student sign-in with a college Google account. Kicks off the Google OAuth
 * flow and redirects the browser to Google's consent screen; control returns
 * to /callback, where the college domain + student-role rules are enforced.
 *
 * The `hd` hint asks Google to prefer the college Workspace domain in its
 * account chooser, but it is only a hint — /callback re-checks the domain
 * server-side, so it cannot be bypassed.
 */
export async function signInWithGoogle(
  _prev: AuthFormState,
  _formData: FormData
): Promise<AuthFormState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  // Build an absolute callback URL from the incoming request (proxy-aware).
  const headerList = await headers();
  const origin = resolveOrigin(headerList);
  if (!origin) {
    return { error: "Could not determine the site URL for Google sign-in." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/callback`,
      queryParams: {
        hd: COLLEGE_EMAIL_DOMAIN,
        prompt: "select_account",
      },
    },
  });
  if (error) return { error: error.message };

  // Clear any stale parent-view flag, then hand off to Google's consent screen.
  await setParentView(false);
  if (data.url) redirect(data.url);
  return { error: "Could not start Google sign-in. Please try again." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await setParentView(false);
  revalidatePath("/", "layout");
  redirect("/login");
}
