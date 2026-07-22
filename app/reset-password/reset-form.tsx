"use client";

import { useActionState } from "react";
import { AlertCircle, ArrowRight, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "./actions";
import type { AuthFormState } from "@/app/(auth)/login/actions";

const INITIAL: AuthFormState = {};

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter your new password"
            required
          />
        </div>
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
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
            Updating…
          </>
        ) : (
          <>
            Set new password
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </>
        )}
      </Button>
    </form>
  );
}
