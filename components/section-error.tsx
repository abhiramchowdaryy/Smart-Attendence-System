"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary for an authenticated section.
 *
 * Scoped per section rather than only at the root so a failed Supabase read
 * on one page degrades to a retry card *inside* the shell — the user keeps
 * the nav and can move elsewhere — instead of the root boundary replacing
 * the entire application chrome with a dead end.
 *
 * The raw `error.message` is deliberately not rendered. Next.js redacts
 * Server Component errors in production, but client-thrown errors are not
 * redacted and can carry query fragments or internal identifiers; the
 * digest is the supportable handle for correlating with server logs.
 */
export function SectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Section error boundary:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border bg-card p-8 text-center"
    >
      <AlertTriangle className="size-10 text-status-late" aria-hidden="true" />
      <h1 className="text-xl font-semibold">This page didn&apos;t load</h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong fetching your data. This is usually temporary —
        try again, or use the navigation above to go elsewhere.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Ref: {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline">
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </div>
  );
}
