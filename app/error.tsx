"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle
        className="size-10 text-status-late"
        aria-hidden="true"
      />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
        {error.digest && (
          <span className="mt-1 block font-mono text-xs">
            Ref: {error.digest}
          </span>
        )}
      </p>
      <Button onClick={reset} variant="outline">
        <RotateCcw className="size-4" aria-hidden="true" />
        Try again
      </Button>
    </main>
  );
}
