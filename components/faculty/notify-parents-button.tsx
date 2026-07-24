"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, MessageSquare } from "lucide-react";
import { notifyShortfallParents } from "@/app/faculty/attendance/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Notify parents" for the students below 75% in a course. Clicking it is the
 * confirmation — it invokes the Twilio edge function via a staff-gated server
 * action and reports how many messages were sent / queued / failed.
 */
export function NotifyParentsButton({
  courseCode,
  count,
}: {
  courseCode: string;
  count: number;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await notifyShortfallParents(courseCode);
      setResult({ ok: res.ok, text: res.error ?? res.message ?? "" });
    });
  }

  return (
    <div className="flex flex-col items-end gap-1 print:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={run}
        disabled={pending || count === 0}
        title="SMS the parents of students below 75%"
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <MessageSquare className="size-4" aria-hidden="true" />
        )}
        {pending ? "Notifying…" : `Notify parents (${count})`}
      </Button>
      {result && (
        <p
          role="status"
          className={cn(
            "max-w-[16rem] text-right text-xs",
            result.ok ? "text-muted-foreground" : "text-destructive"
          )}
        >
          {result.text}
        </p>
      )}
    </div>
  );
}
