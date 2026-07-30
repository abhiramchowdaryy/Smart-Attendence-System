"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  openSession,
  type SessionFormState,
} from "@/app/faculty/dashboard/actions";

interface GeofenceOption {
  id: string;
  room_name: string;
  radius_m: number;
}

const INITIAL: SessionFormState = {};

export function OpenSessionForm({ geofences }: { geofences: GeofenceOption[] }) {
  const qc = useQueryClient();
  const [state, setState] = useState<SessionFormState>(INITIAL);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await openSession(state, formData);
    setState(result);
    setPending(false);
    if (result.message) {
      // Mirror the removed revalidatePath("/faculty/dashboard") +
      // revalidatePath("/student/mark-attendance").
      qc.invalidateQueries({ queryKey: ["faculty-dashboard"] });
      qc.invalidateQueries({ queryKey: ["mark-attendance"] });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="course">Course</Label>
        <Input
          id="course"
          name="course"
          placeholder="e.g. Data Structures"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="geofenceId">Classroom geofence</Label>
        <select
          id="geofenceId"
          name="geofenceId"
          required
          defaultValue=""
          suppressHydrationWarning
          className="flex h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="" disabled>
            Choose a room…
          </option>
          {geofences.map((g) => (
            <option key={g.id} value={g.id}>
              {g.room_name} (radius {g.radius_m} m)
            </option>
          ))}
        </select>
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
          className="flex items-start gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </p>
      )}

      <Button type="submit" variant="accent" className="w-full" disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-4" aria-hidden="true" />
        )}
        {pending ? "Opening…" : "Open session"}
      </Button>
    </form>
  );
}
