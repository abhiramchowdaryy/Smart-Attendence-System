"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeSession } from "@/app/faculty/dashboard/actions";

export function CloseSessionButton({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await closeSession(sessionId);
            setError(res.error ?? null);
            if (!res.error) {
              // Mirror revalidatePath("/faculty/dashboard") +
              // ("/student/mark-attendance") + ("/student/dashboard").
              qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
              qc.invalidateQueries({ queryKey: ["mark-attendance"] });
              qc.invalidateQueries({ queryKey: ["student-dashboard"] });
            }
          })
        }
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Square className="size-4" aria-hidden="true" />
        )}
        {pending ? "Closing…" : "Close session"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
