"use client";

import { useActionState, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addTimetableSlot,
  deleteTimetableSlot,
  type TimetableState,
} from "@/app/admin/timetable/actions";
import {
  DAY_NAMES,
  DAY_SHORT,
  formatTime,
  groupByDay,
  type TimetableSlot,
} from "@/lib/timetable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: TimetableState = {};

export interface CourseOption {
  code: string;
  name: string;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TimetableManager({
  slots,
  courses,
}: {
  slots: TimetableSlot[];
  courses: CourseOption[];
}) {
  const [state, action, pending] = useActionState(addTimetableSlot, INITIAL);
  const [delError, setDelError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const days = groupByDay(slots);

  function remove(id: string) {
    setDelError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteTimetableSlot(id);
      if (res.error) setDelError(res.error);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* Weekly grid */}
      {slots.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No timetable slots yet — add the first class below.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map((daySlots, i) => (
            <div key={i} className="rounded-lg border bg-card">
              <div className="border-b px-3 py-2">
                <p className="text-sm font-semibold">{DAY_NAMES[i + 1]}</p>
              </div>
              <div className="space-y-2 p-3">
                {daySlots.length === 0 ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    No classes
                  </p>
                ) : (
                  daySlots.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-2 rounded-md bg-muted/40 p-2.5"
                    >
                      <Clock
                        className="mt-0.5 size-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.course_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(s.start_time)} – {formatTime(s.end_time)}
                          {s.section ? ` · Sec ${s.section}` : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${s.course_name} on ${DAY_NAMES[i + 1]}`}
                        disabled={deletingId === s.id}
                        onClick={() => remove(s.id)}
                        className="rounded p-1 text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {deletingId === s.id ? (
                          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {delError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {delError}
        </p>
      )}

      {/* Add slot */}
      <form action={action} className="space-y-4 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">Add a class</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tt-course">Course</Label>
            <select id="tt-course" name="courseCode" required defaultValue="" className={selectClass}>
              <option value="" disabled>Choose a course…</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tt-day">Day</Label>
            <select id="tt-day" name="dayOfWeek" required defaultValue="" className={selectClass}>
              <option value="" disabled>Choose a day…</option>
              {[1, 2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {DAY_SHORT[d]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="tt-start">Start</Label>
            <Input id="tt-start" name="startTime" type="time" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tt-end">End</Label>
            <Input id="tt-end" name="endTime" type="time" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tt-section">Section</Label>
            <Input id="tt-section" name="section" placeholder="A" />
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

        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {pending ? "Saving…" : "Add class"}
        </Button>
      </form>
    </div>
  );
}
