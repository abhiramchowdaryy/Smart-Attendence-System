import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/utils";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage() {
  if (!supabaseConfigured()) redirect("/login");

  // The recovery link (handled by /auth/confirm) establishes a session
  // before landing here. No session → the link was invalid or expired.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      "/login?error=" +
        encodeURIComponent("That reset link is invalid or has expired.")
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-pop">
        <div
          aria-hidden="true"
          className="h-1 w-full bg-gradient-to-r from-[hsl(var(--pes-orange))] via-[hsl(var(--pes-amber-aa))] to-transparent"
        />
        <div className="space-y-6 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <KeyRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">
                Choose a new password
              </h1>
              <p className="text-sm text-muted-foreground">
                Signed in as {user.email}
              </p>
            </div>
          </div>

          <ResetForm />
        </div>
      </div>
    </main>
  );
}
