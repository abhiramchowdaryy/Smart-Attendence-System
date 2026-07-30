"use client";

import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, BarChart3, CalendarCheck2, ShieldCheck } from "lucide-react";
import { useAuth, roleHome } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/utils";
import { PageSkeleton } from "@/components/page-skeleton";
import { PageTitle } from "@/src/page-title";
import { ParentLoginForm } from "./parent-login-form";
import { LoginWatermark } from "@/components/login-watermark";
import { LoginPreviewCards } from "@/components/login-preview-cards";
import { PesLogo } from "@/components/pes-logo";

const FEATURES = [
  { Icon: CalendarCheck2, text: "See your child's attendance, class by class" },
  { Icon: BarChart3, text: "Follow results and performance trends" },
  { Icon: ShieldCheck, text: "Sign in with your child's student login" },
];

/** Dot-grid texture, tinted per surface. */
const DOTS_LIGHT = {
  backgroundImage:
    "radial-gradient(circle, hsl(var(--foreground) / 0.06) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
} as const;
const DOTS_DARKPANEL = {
  backgroundImage:
    "radial-gradient(circle, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
} as const;

export default function ParentLoginPage() {
  const { loading, user, profile, parentView } = useAuth();

  // Already signed in? A parent (parentView flag) goes to the parent
  // dashboard; anyone else goes to their normal role home.
  if (loading) return <PageSkeleton />;
  if (user && profile) {
    if (parentView) return <Navigate to="/parent/dashboard" replace />;
    return <Navigate to={roleHome(profile.role)} replace />;
  }

  return (
    <>
    <PageTitle title="Parent sign in" />
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* ── Brand / product panel ─────────────────────────────────── */}
      <aside className="relative hidden flex-col overflow-hidden bg-[hsl(var(--pes-navy))] p-10 text-white lg:flex">
        {/* Layered background: glows + dot grid + animated watermark */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(52rem 36rem at 12% -10%, hsl(226 71% 46% / .55), transparent 60%), radial-gradient(40rem 30rem at 105% 110%, hsl(27 79% 54% / .18), transparent 60%)",
          }}
        />
        <div aria-hidden="true" className="absolute inset-0" style={DOTS_DARKPANEL} />
        <LoginWatermark variant="strong" />

        {/* Content */}
        <div className="relative z-10 flex items-center gap-3.5">
          <span className="flex items-center rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
            <PesLogo variant="dark" priority className="h-9" />
          </span>
          <span aria-hidden="true" className="h-9 w-px bg-white/20" />
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-white/80">
            Smart Attendance
            <br />
            System
          </p>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center gap-10 py-10">
          <LoginPreviewCards />

          <div className="space-y-5">
            <h2 className="font-display text-4xl font-bold leading-[1.15]">
              Stay close to your{" "}
              <span className="text-[hsl(var(--pes-orange))]">child&apos;s</span>{" "}
              progress.
            </h2>
            <ul className="space-y-3">
              {FEATURES.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/85">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/10">
                    <Icon className="size-4 text-[hsl(var(--pes-orange))]" aria-hidden="true" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/50">
          Phase-1 · Web Development · Guide: Prof. Niteesh K R
        </p>
      </aside>

      {/* ── Form panel ────────────────────────────────────────────── */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-background p-6 sm:p-10">
        {/* Texture: dot grid + a whisper of primary tint */}
        <div aria-hidden="true" className="absolute inset-0" style={DOTS_LIGHT} />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(36rem 24rem at 88% -8%, hsl(var(--primary) / 0.08), transparent 62%)",
          }}
        />
        <div className="lg:hidden">
          <LoginWatermark variant="faint" />
        </div>

        {/* Mobile brand header */}
        <div className="relative z-10 mb-6 flex flex-col items-center gap-2 lg:hidden">
          <PesLogo priority className="h-11" />
          <p className="font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Smart Attendance System
          </p>
        </div>

        {/* The card anchors the form instead of floating in a void */}
        <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-pop">
          {/* PES-orange hairline ties the brand across both panels */}
          <div
            aria-hidden="true"
            className="h-1 w-full bg-gradient-to-r from-[hsl(var(--pes-orange))] via-[hsl(var(--pes-amber-aa))] to-transparent"
          />
          <div className="space-y-6 p-6 sm:p-8">
            {!supabaseConfigured() && (
              <div
                role="alert"
                className="rounded-md border border-status-late/40 bg-status-late/10 p-4 text-sm"
              >
                <p className="font-semibold text-status-late">Setup required</p>
                <p className="mt-1 text-muted-foreground">
                  No Supabase credentials found. Copy{" "}
                  <code className="font-mono text-xs">.env.example</code> to{" "}
                  <code className="font-mono text-xs">.env.local</code>, create
                  a free project at supabase.com, run{" "}
                  <code className="font-mono text-xs">supabase/schema.sql</code>
                  , then restart the dev server.
                </p>
              </div>
            )}
            <ParentLoginForm />

            {/* Route back to the student / staff sign-in */}
            <Link
              to="/login"
              className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Student or staff sign in
            </Link>
          </div>
        </div>

        <p className="relative z-10 mt-6 text-center text-xs text-muted-foreground">
          Team Preethika · Preethi · Nesara · Monisha — PES University
        </p>
      </div>
    </main>
    </>
  );
}
