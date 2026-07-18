"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  sendMagicLink,
  signInWithPassword,
  type AuthFormState,
} from "./actions";

const INITIAL: AuthFormState = {};

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

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [pwState, pwAction, pwPending] = useActionState(
    signInWithPassword,
    INITIAL
  );
  const [mlState, mlAction, mlPending] = useActionState(sendMagicLink, INITIAL);

  const state = mode === "password" ? pwState : mlState;
  const pending = mode === "password" ? pwPending : mlPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome back
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your institutional account to continue.
        </p>
      </div>

      <form
        action={mode === "password" ? pwAction : mlAction}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <IconInput
            icon={Mail}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@pes.edu"
            required
          />
        </div>

        {mode === "password" && (
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

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.message && (
          <FormMessage tone="success">{state.message}</FormMessage>
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
              {mode === "password" ? "Signing in…" : "Sending link…"}
            </>
          ) : mode === "password" ? (
            <>
              Sign in
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          ) : (
            <>
              <Mail className="size-4" aria-hidden="true" />
              Send magic link
            </>
          )}
        </Button>
      </form>

      {/* Divider + mode switch */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          or
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        suppressHydrationWarning
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
        // min-h-11 keeps this a 44px touch target on phones
        className="flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-transparent px-4 py-2 text-center text-sm font-medium transition-colors hover:bg-muted"
      >
        {mode === "password"
          ? "Sign in with a magic link instead"
          : "Sign in with password instead"}
      </button>
    </motion.div>
  );
}
