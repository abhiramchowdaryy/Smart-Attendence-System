"use client";

import { MapPin, MapPinOff, LoaderCircle, Ban } from "lucide-react";
import type { GeofenceState } from "@/hooks/use-geofence";
import { cn } from "@/lib/utils";

/**
 * Live geofence chip: green inside, red outside (with distance),
 * amber while seeking. Icon + text always accompany the color.
 */
export function GeofenceIndicator({
  state,
  roomName,
}: {
  state: GeofenceState;
  roomName: string;
}) {
  const base =
    "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium";

  switch (state.status) {
    case "unsupported":
      return (
        <div role="status" className={cn(base, "border-destructive/40 bg-destructive/10 text-destructive")}>
          <Ban className="size-4 shrink-0" aria-hidden="true" />
          This device does not support location.
        </div>
      );
    case "denied":
      return (
        <div role="alert" className={cn(base, "border-destructive/40 bg-destructive/10 text-destructive")}>
          <MapPinOff className="size-4 shrink-0" aria-hidden="true" />
          {state.message}
        </div>
      );
    case "seeking":
      return (
        <div role="status" className={cn(base, "border-status-late/40 bg-status-late/10 text-status-late")}>
          {/* Radar ping while acquiring a fix */}
          <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-late opacity-60" />
            <LoaderCircle className="relative size-4 animate-spin" />
          </span>
          Locating you…
        </div>
      );
    case "inside":
      return (
        <div role="status" className={cn(base, "border-status-present/40 bg-status-present/10 text-status-present")}>
          {/* Steady pulse confirms an active, in-bounds fix */}
          <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
            <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-status-present opacity-40 [animation-duration:2.5s]" />
            <MapPin className="relative size-4" />
          </span>
          Inside “{roomName}” · {state.distance} m from center
          <span className="ml-auto font-mono text-xs opacity-70">
            ±{state.accuracy} m
          </span>
        </div>
      );
    case "outside":
      return (
        <div role="status" className={cn(base, "border-status-absent/40 bg-status-absent/10 text-status-absent")}>
          <MapPinOff className="size-4 shrink-0" aria-hidden="true" />
          Outside geofence — {state.distance} m from “{roomName}”
          <span className="ml-auto font-mono text-xs opacity-70">
            ±{state.accuracy} m
          </span>
        </div>
      );
  }
}
