"use server";

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

  revalidatePath("/", "layout");
  return redirectToRoleHome(supabase, data.user.id);
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
  revalidatePath("/", "layout");
  redirect("/login");
}
