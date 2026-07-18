"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import {
  Crosshair,
  LoaderCircle,
  MapPin,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createGeofence,
  deleteGeofence,
  type AdminActionState,
} from "@/app/admin/dashboard/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface GeofenceRow {
  id: string;
  room_name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

const INITIAL: AdminActionState = {};

/**
 * Geofence CRUD. "Use my location" fills lat/lng from the browser —
 * stand in the classroom, tap it, save. (The map-pin editor is the
 * Phase-2 upgrade; coordinates are the dependency-free MVP.)
 */
export function GeofenceManager({ geofences }: { geofences: GeofenceRow[] }) {
  const [state, action, pending] = useActionState(createGeofence, INITIAL);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  function useMyLocation() {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("This device does not support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (latRef.current) latRef.current.value = pos.coords.latitude.toFixed(6);
        if (lngRef.current) lngRef.current.value = pos.coords.longitude.toFixed(6);
        setLocating(false);
      },
      (err) => {
        setLocError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied."
            : err.message
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function remove(id: string) {
    setDelError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteGeofence(id);
      if (res.error) setDelError(res.error);
      setDeletingId(null);
    });
  }

  return (
    <div className="space-y-5">
      {/* Existing geofences */}
      {geofences.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No geofences yet — add your first classroom below.
        </p>
      ) : (
        <ul className="space-y-2">
          {geofences.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3 text-sm transition-colors hover:bg-muted/50"
            >
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{g.room_name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {Number(g.lat).toFixed(5)}, {Number(g.lng).toFixed(5)} · r{" "}
                  {g.radius_m} m
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete geofence ${g.room_name}`}
                disabled={deletingId === g.id}
                onClick={() => remove(g.id)}
              >
                {deletingId === g.id ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {delError && <FormMessage tone="error">{delError}</FormMessage>}

      {/* Add new */}
      <form action={action} className="space-y-4 rounded-md border border-dashed p-4">
        <p className="text-sm font-medium">Add a classroom</p>

        <div className="space-y-2">
          <Label htmlFor="roomName">Room name</Label>
          <Input id="roomName" name="roomName" placeholder="e.g. Room B-204" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              ref={latRef}
              id="lat" name="lat" type="number" step="any"
              placeholder="12.935100" required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              ref={lngRef}
              id="lng" name="lng" type="number" step="any"
              placeholder="77.535800" required
            />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          disabled={locating}
        >
          {locating ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="size-4" aria-hidden="true" />
          )}
          {locating ? "Locating…" : "Use my current location"}
        </Button>
        {locError && (
          <p role="alert" className="text-sm text-error">{locError}</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="radiusM">Radius (metres)</Label>
          <Input
            id="radiusM" name="radiusM" type="number"
            min={5} max={2000} defaultValue={100} required
          />
        </div>

        {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
        {state.message && (
          <FormMessage tone="success">{state.message}</FormMessage>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {pending ? "Saving…" : "Add geofence"}
        </Button>
      </form>
    </div>
  );
}
