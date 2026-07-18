"use client";

import { useActionState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  const [state, action, pending] = useActionState(openSession, INITIAL);

  return (
    <form action={action} className="space-y-4">
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
        <Select id="geofenceId" name="geofenceId" required defaultValue="">
          <option value="" disabled>
            Choose a room…
          </option>
          {geofences.map((g) => (
            <option key={g.id} value={g.id}>
              {g.room_name} (radius {g.radius_m} m)
            </option>
          ))}
        </Select>
      </div>

      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.message && (
        <FormMessage tone="success">{state.message}</FormMessage>
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
