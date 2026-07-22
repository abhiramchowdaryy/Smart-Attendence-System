"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, supabaseConfigured, type Role } from "@/lib/utils";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const NOT_CONFIGURED =
  "Supabase is not configured. Copy .env.example to .env.local and add your project credentials.";

const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
};

function isRole(v: string): v is Role {
  return v === "student" || v === "faculty" || v === "admin";
}

/**
 * Turn what the user typed into an account email. Emails pass through; a
 * PES register number (e.g. PES1UG24CA119) is resolved via the
 * `email_for_roll_no` RPC. Returns null when no account matches.
 */
async function resolveEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  identifier: string
): Promise<string | null> {
  if (identifier.includes("@")) return identifier;
  const { data } = await supabase.rpc("email_for_roll_no", {
    p_roll: identifier,
  });
  return typeof data === "string" && data.length > 0 ? data : null;
}

/** Register-number (or email) + password sign-in, gated by the chosen role. */
export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const remember = formData.get("remember") != null;

  if (!identifier || !password) {
    return { error: "Enter your register number and password." };
  }
  if (!isRole(roleRaw)) {
    return { error: "Choose whether you are a student, faculty or admin." };
  }
  const selectedRole = roleRaw;

  // Persist the "remember me" choice: the flag lets the middleware keep
  // refreshed cookies session-scoped too when the user opted out.
  const cookieStore = await cookies();
  cookieStore.set("sa-remember", remember ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    ...(remember ? { maxAge: 60 * 60 * 24 * 400 } : {}),
  });

  const supabase = await createClient({ sessionOnly: !remember });

  const email = await resolveEmail(supabase, identifier);
  if (!email) {
    return { error: "No account found for that register number." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  // The chosen role must match the account's actual role — the picker is
  // UX, not authorization. (RLS is still the final gate on data.)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  const actualRole = (profile?.role as Role) ?? "student";

  if (actualRole !== selectedRole) {
    await supabase.auth.signOut();
    return {
      error: `This account is registered as ${ROLE_LABEL[actualRole]}, not ${ROLE_LABEL[selectedRole]}. Pick ${ROLE_LABEL[actualRole]} and try again.`,
    };
  }

  revalidatePath("/", "layout");
  redirect(ROLE_HOME[actualRole]);
}

/** Send a password-reset email for a register number or email address. */
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };

  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) {
    return { error: "Enter your register number or email to reset." };
  }

  const supabase = await createClient();
  const email = await resolveEmail(supabase, identifier);

  // Always report success — never reveal whether an account exists.
  const done = {
    message:
      "If an account matches, a password-reset link is on its way. Check your inbox.",
  };
  if (!email) return done;

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=/reset-password`,
  });
  return done;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete("sa-remember");
  revalidatePath("/", "layout");
  redirect("/login");
}
