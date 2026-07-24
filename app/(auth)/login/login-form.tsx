"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithGoogle,
  signInWithPassword,
  type AuthFormState,
} from "./actions";

const INITIAL: AuthFormState = {};

/** Google "G" mark — inline SVG so it needs no network request. */
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.75-2.1-6.69-4.93H1.3v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.31 14.32a7.21 7.21 0 0 1 0-4.62V6.61H1.3a12 12 0 0 0 0 10.79l4.01-3.08Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.79l3.43-3.43C17.95 1.18 15.24 0 12 0A12 12 0 0 0 1.3 6.61l4.01 3.09C6.25 6.86 8.89 4.75 12 4.75Z"
      />
    </svg>
  );
}

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
  const [pwState, pwAction, pwPending] = useActionState(
    signInWithPassword,
    INITIAL
  );
  const [googleState, googleAction, googlePending] = useActionState(
    signInWithGoogle,
    INITIAL
  );

  // Surface whichever action last reported a problem.
  const error = googleState.error ?? pwState.error;

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

      {/* Students → college Google account. */}
      <form action={googleAction}>
        <Button
          type="submit"
          size="lg"
          variant="outline"
          className="w-full gap-2.5 transition-all duration-200 hover:shadow-pop"
          disabled={googlePending}
        >
          {googlePending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Redirecting to Google…
            </>
          ) : (
            <>
              <GoogleIcon className="size-5" />
              Sign in with college Google account
            </>
          )}
        </Button>
      </form>
      <p className="-mt-3 text-center text-xs text-muted-foreground">
        Students only — use your <span className="font-medium">@pes.edu</span>{" "}
        account.
      </p>

      {/* Divider between student SSO and staff password sign-in. */}
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Faculty &amp; admin
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={pwAction} className="space-y-4">
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

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="group w-full transition-all duration-200 hover:shadow-pop"
          disabled={pwPending}
        >
          {pwPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}
