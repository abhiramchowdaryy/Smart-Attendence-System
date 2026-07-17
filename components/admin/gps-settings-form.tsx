"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Save } from "lucide-react";
import {
  updateGpsSettings,
  type SettingsResult,
} from "@/app/admin/settings/actions";
import { GPS_LIMITS, type GpsSettings } from "@/lib/gps-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: SettingsResult = {};

export function GpsSettingsForm({ settings }: { settings: GpsSettings }) {
  const [state, action, pending] = useActionState(updateGpsSettings, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="accuracy_grace_m">Accuracy grace (metres)</Label>
          <Input
            id="accuracy_grace_m"
            name="accuracy_grace_m"
            type="number"
            inputMode="numeric"
            defaultValue={settings.accuracyGraceM}
            min={GPS_LIMITS.accuracyGraceM.min}
            max={GPS_LIMITS.accuracyGraceM.max}
            required
          />
          <p className="text-xs text-muted-foreground">
            Extra distance beyond the geofence radius allowed for GPS drift.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="late_after_min">Late after (minutes)</Label>
          <Input
            id="late_after_min"
            name="late_after_min"
            type="number"
            inputMode="numeric"
            defaultValue={settings.lateAfterMin}
            min={GPS_LIMITS.lateAfterMin.min}
            max={GPS_LIMITS.lateAfterMin.max}
            required
          />
          <p className="text-xs text-muted-foreground">
            Entries this many minutes after a session opens are marked Late.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-md border p-3">
        <input
          type="checkbox"
          name="high_accuracy"
          defaultChecked={settings.highAccuracy}
          className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
        />
        <span className="text-sm">
          <span className="font-medium">High-accuracy location</span>
          <span className="block text-xs text-muted-foreground">
            Ask devices for GPS-grade positioning. More precise, slightly
            slower and more battery — recommended on.
          </span>
        </span>
      </label>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-md bg-status-present/10 p-3 text-sm text-status-present"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          GPS policy saved.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        {pending ? "Saving…" : "Save policy"}
      </Button>
    </form>
  );
}
