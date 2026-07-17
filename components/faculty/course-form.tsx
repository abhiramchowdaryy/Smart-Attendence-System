"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import {
  upsertCourse,
  type CourseActionState,
} from "@/app/faculty/courses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: CourseActionState = {};

/**
 * Create/edit a course. Saving an existing code updates it in place
 * (upsert), which is also how backfilled placeholder courses get their
 * real names and credits.
 */
export function CourseForm({
  editing,
}: {
  /** Prefill for editing, or null for a blank create form. */
  editing: {
    code: string;
    name: string;
    credits: number;
    semester: string;
  } | null;
}) {
  const [state, action, pending] = useActionState(upsertCourse, INITIAL);

  return (
    <form action={action} key={editing?.code ?? "new"} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Course code</Label>
          <Input
            id="code"
            name="code"
            placeholder="UQ24CA221B"
            defaultValue={editing?.code ?? ""}
            className="font-mono"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Course name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Personality Development"
            defaultValue={editing?.name ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits">Credits</Label>
          <Input
            id="credits"
            name="credits"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={10}
            defaultValue={editing?.credits ?? 3}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="semester">Semester</Label>
          <Input
            id="semester"
            name="semester"
            placeholder="Sem-4"
            defaultValue={editing?.semester ?? ""}
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
      {state.message && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        {pending ? "Saving…" : editing ? "Update course" : "Add course"}
      </Button>
    </form>
  );
}
