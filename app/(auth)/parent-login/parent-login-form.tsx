"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, signInAsParent } from "@/lib/auth";

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

/**
 * Parent sign-in form. There is no separate parent account — the parent signs
 * in with their child's own student email and password and lands on the
 * read-only parent dashboard for that student.
 */
export function ParentLoginForm() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await signInAsParent(
      String(form.get("email") ?? ""),
      String(form.get("password") ?? "")
    );
    if (res.error) {
      setError(res.error);
      setPending(false);
      return;
    }
    await refresh();
    navigate("/parent/dashboard", { replace: true });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Parent sign in
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your child&apos;s student email and password to follow
          their attendance and results.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Student email</Label>
          <IconInput
            icon={Mail}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="student@pes.edu"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Student password</Label>
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
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            <>
              View my child&apos;s progress
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
