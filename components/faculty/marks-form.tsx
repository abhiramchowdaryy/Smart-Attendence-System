"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { upsertMark, type MarkFormState } from "@/app/faculty/marks/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StudentOption {
  id: string;
  full_name: string;
  roll_no: string | null;
}

const INITIAL: MarkFormState = {};

/** Add/update one assessment score. Same (student, course, assessment) overwrites. */
export function MarksForm({
  students,
  courses,
}: {
  students: StudentOption[];
  courses: string[];
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<MarkFormState>(INITIAL);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await upsertMark(state, formData);
    setState(result);
    setPending(false);
    if (result.message) {
      // Mirror revalidatePath("/faculty/marks") + ("/faculty/performance") +
      // ("/student/dashboard").
      qc.invalidateQueries({ queryKey: ["faculty-marks"] });
      qc.invalidateQueries({ queryKey: ["faculty-performance"] });
      qc.invalidateQueries({ queryKey: ["student-dashboard"] });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studentId">Student</Label>
        <select
          id="studentId"
          name="studentId"
          required
          defaultValue=""
          suppressHydrationWarning
          className="flex h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Choose a student…
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.roll_no ? ` (${s.roll_no})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="course">Course</Label>
          <Input
            id="course"
            name="course"
            list="course-suggestions"
            placeholder="Data Structures"
            required
          />
          <datalist id="course-suggestions">
            {courses.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="assessment">Assessment</Label>
          <Input
            id="assessment"
            name="assessment"
            placeholder="e.g. ISA-1"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="score">Score</Label>
          <Input
            id="score" name="score" type="number"
            min={0} step="0.5" placeholder="42" required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxScore">Out of</Label>
          <Input
            id="maxScore" name="maxScore" type="number"
            min={1} step="0.5" defaultValue={100} required
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {pending ? "Saving…" : "Save mark"}
      </Button>
    </form>
  );
}
