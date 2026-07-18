"use client";

import { useActionState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { upsertMark, type MarkFormState } from "@/app/faculty/marks/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

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
  const [state, action, pending] = useActionState(upsertMark, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="studentId">Student</Label>
        <Select id="studentId" name="studentId" required defaultValue="">
          <option value="" disabled>
            Choose a student…
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
              {s.roll_no ? ` (${s.roll_no})` : ""}
            </option>
          ))}
        </Select>
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

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.message && (
        <FormMessage tone="success">{state.message}</FormMessage>
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
