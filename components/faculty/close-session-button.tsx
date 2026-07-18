"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeSession } from "@/app/faculty/dashboard/actions";

/**
 * Closing a session stamps everyone's exit time — not undoable — so a
 * first tap arms an inline confirm instead of firing immediately.
 */
export function CloseSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirming && !pending) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            onClick={() =>
              startTransition(async () => {
                const res = await closeSession(sessionId);
                setError(res.error ?? null);
                setConfirming(false);
              })
            }
          >
            <Square className="size-4" aria-hidden="true" />
            Confirm close
          </Button>
          <Button variant="outline" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          Ends the session and stamps exit times for everyone still in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Square className="size-4" aria-hidden="true" />
        )}
        {pending ? "Closing…" : "Close session"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
