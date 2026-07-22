"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideCorrection } from "@/app/admin/corrections/actions";

/** Approve / reject buttons for one pending correction. */
export function CorrectionDecision({ correctionId }: { correctionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<"approved" | "rejected" | null>(null);

  function decide(decision: "approved" | "rejected") {
    setError(null);
    setActing(decision);
    startTransition(async () => {
      const res = await decideCorrection(correctionId, decision);
      if (res.error) {
        setError(res.error);
        setActing(null);
      }
      // On success the page revalidates and this row disappears.
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={pending}
          onClick={() => decide("approved")}
        >
          {pending && acting === "approved" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => decide("rejected")}
        >
          {pending && acting === "rejected" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <X className="size-4" aria-hidden="true" />
          )}
          Reject
        </Button>
      </div>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
