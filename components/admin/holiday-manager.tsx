"use client";

import { useActionState, useState, useTransition } from "react";
import {
  AlertCircle,
  CalendarOff,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Trash2,
} from "lucide-react";
import {
  addHoliday,
  deleteHoliday,
  type InstitutionState,
} from "@/app/admin/institution/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: InstitutionState = {};

export interface HolidayRow {
  id: string;
  day: string;
  name: string;
}

function fmt(day: string): string {
  // Parse as a plain date (no timezone shift).
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function HolidayManager({ holidays }: { holidays: HolidayRow[] }) {
  const [state, action, pending] = useActionState(addHoliday, INITIAL);
  const [delError, setDelError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function remove(id: string) {
    setDelError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteHoliday(id);
      if (res.error) setDelError(res.error);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {holidays.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No holidays yet — add key dates below.
        </p>
      ) : (
        <ul className="space-y-2">
          {holidays.map((h) => (
            <li
              key={h.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
            >
              <CalendarOff className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(h.day)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete holiday ${h.name}`}
                disabled={deletingId === h.id}
                onClick={() => remove(h.id)}
              >
                {deletingId === h.id ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {delError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {delError}
        </p>
      )}

      <form action={action} className="space-y-4 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">Add a holiday</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor="hol-day">Date</Label>
            <Input id="hol-day" name="day" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hol-name">Occasion</Label>
            <Input id="hol-name" name="name" placeholder="Independence Day" required />
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
          {pending ? "Saving…" : "Add holiday"}
        </Button>
      </form>
    </div>
  );
}
