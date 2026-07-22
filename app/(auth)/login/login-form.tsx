"use client";

import { useActionState, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  IdCard,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/utils";
import {
  requestPasswordReset,
  signInWithPassword,
  type AuthFormState,
} from "./actions";

const INITIAL: AuthFormState = {};

const ROLES: { value: Role; label: string; Icon: typeof GraduationCap }[] = [
  { value: "student", label: "Student", Icon: GraduationCap },
  { value: "faculty", label: "Faculty", Icon: Users },
  { value: "admin", label: "Admin", Icon: ShieldCheck },
];

/** Input with a leading icon — visual anchor without sacrificing labels. */
function IconInput({
  icon: Icon,
  ...props
}: React.ComponentProps<typeof Input> & { icon: typeof Mail }) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input className="pl-9" {...props} />
    </div>
  );
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [role, setRole] = useState<Role>("student");
  const [pwState, pwAction, pwPending] = useActionState(
    signInWithPassword,
    INITIAL
  );
  const [rsState, rsAction, rsPending] = useActionState(
    requestPasswordReset,
    INITIAL
  );

  const state = mode === "signin" ? pwState : rsState;
  const pending = mode === "signin" ? pwPending : rsPending;
  const roleLabel = ROLES.find((r) => r.value === role)!.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {mode === "signin" ? "Welcome back" : "Reset your password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === "signin"
            ? "Choose your role and sign in with your register number."
            : "Enter your register number or email and we'll send a reset link."}
        </p>
      </div>

      {mode === "signin" && (
        <div>
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            I am a
          </span>
          <div
            role="radiogroup"
            aria-label="Select your role"
            className="grid grid-cols-3 gap-2"
          >
            {ROLES.map(({ value, label, Icon }) => {
              const active = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(value)}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form action={mode === "signin" ? pwAction : rsAction} className="space-y-4">
        {/* Selected role travels with the sign-in submit. */}
        {mode === "signin" && <input type="hidden" name="role" value={role} />}

        <div className="space-y-2">
          <Label htmlFor="identifier">
            {mode === "signin" ? "Register number" : "Register number or email"}
          </Label>
          <IconInput
            icon={mode === "signin" ? IdCard : Mail}
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="PES1UG24CA119"
            required
          />
          {mode === "signin" && (
            <p className="text-xs text-muted-foreground">
              Use your PES register number, or your email address.
            </p>
          )}
        </div>

        {mode === "signin" && (
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <IconInput
              icon={Lock}
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
        )}

        {mode === "signin" && (
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                name="remember"
                defaultChecked
                className="size-4 cursor-pointer rounded border-input accent-primary"
              />
              Remember me
            </label>
            <button
              type="button"
              onClick={() => setMode("reset")}
              className="cursor-pointer text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {(state.error || (mode === "signin" && initialError)) && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.error ?? initialError}
          </p>
        )}
        {state.message && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {state.message}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="group w-full transition-all duration-200 hover:shadow-pop"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {mode === "signin" ? "Signing in…" : "Sending link…"}
            </>
          ) : mode === "signin" ? (
            <>
              Sign in as {roleLabel}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              <Mail className="size-4" aria-hidden="true" />
              Send reset link
            </>
          )}
        </Button>
      </form>

      {mode === "reset" && (
        <button
          type="button"
          onClick={() => setMode("signin")}
          className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to sign in
        </button>
      )}
    </motion.div>
  );
}
