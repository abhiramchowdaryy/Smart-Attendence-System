"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { redirectToRoleHome } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/utils";

export interface AuthFormState {
  error?: string;
  message?: string;
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

/** Passwordless magic-link sign-in. */
export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email to receive a magic link." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) return { error: error.message };

  return { message: `Magic link sent to ${email}. Check your inbox.` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await setParentView(false);
  revalidatePath("/", "layout");
  redirect("/login");
}
