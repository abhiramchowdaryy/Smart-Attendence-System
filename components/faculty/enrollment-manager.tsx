"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  UserCheck,
  Users,
} from "lucide-react";
import {
  setEnrollments,
  type CourseActionState,
} from "@/app/faculty/courses/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StudentOption {
  id: string;
  full_name: string;
  roll_no: string | null;
}

/**
 * Roster editor for one course: tick the enrolled students, save syncs
 * the diff (new enrolments in, unchecked deactivated — history kept).
 */
export function EnrollmentManager({
  courseCode,
  students,
  enrolledIds,
}: {
  courseCode: string;
  students: StudentOption[];
  enrolledIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(enrolledIds));
  const [result, setResult] = useState<CourseActionState>({});
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const dirty =
    selected.size !== enrolledIds.length ||
    enrolledIds.some((id) => !selected.has(id));

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {students.map((s) => {
          const checked = selected.has(s.id);
          return (
            <li key={s.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50",
                  checked && "bg-primary/5"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="size-4 accent-[hsl(var(--primary))]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.full_name}</span>
                  {s.roll_no && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.roll_no}
                    </span>
                  )}
                </span>
                {checked && (
                  <UserCheck
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                )}
              </label>
            </li>
          );
        })}
        {students.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            No student accounts yet.
          </li>
        )}
      </ul>

      {result.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {result.error}
        </p>
      )}
      {result.message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {result.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <Users className="mr-1 inline size-3.5" aria-hidden="true" />
          {selected.size} of {students.length} selected
        </p>
        <Button
          disabled={pending || !dirty}
          onClick={() =>
            startTransition(async () => {
              setResult(await setEnrollments(courseCode, [...selected]));
            })
          }
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserCheck className="size-4" aria-hidden="true" />
          )}
          {pending ? "Saving…" : "Save roster"}
        </Button>
      </div>
    </div>
  );
}
