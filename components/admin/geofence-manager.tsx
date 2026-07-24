"use client";

import { useActionState, useState, useTransition } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Crosshair,
  LoaderCircle,
  Map as MapIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPicker } from "@/components/admin/map-picker";

export interface GeofenceRow {
  id: string;
  room_name: string;
  lat: number;
  lng: number;
  radius_m: number;
}

const INITIAL: AdminActionState = {};

/** Where the map opens before a location is set (PES University, Bengaluru). */
const DEFAULT_CENTER = { lat: 12.9351, lng: 77.5358 };

/**
 * Geofence CRUD. Coordinates can be typed, filled from the browser with
 * "Use my location" (stand in the classroom, tap it), or placed visually
 * with "Pick on map" (a dependency-free OpenStreetMap picker). All three
 * write the same controlled lat/lng, and the radius previews to scale on
 * the map.
 */
export function GeofenceManager({ geofences }: { geofences: GeofenceRow[] }) {
  const [state, action, pending] = useActionState(createGeofence, INITIAL);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [delError, setDelError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Controlled so the map, the "use my location" button and the text inputs
  // all share one source of truth for the coordinates.
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radiusM, setRadiusM] = useState(100);
  const [showMap, setShowMap] = useState(false);

  // Numeric centre for the map: the typed coords when valid, else the default.
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const mapLat = Number.isFinite(latNum) && lat !== "" ? latNum : DEFAULT_CENTER.lat;
  const mapLng = Number.isFinite(lngNum) && lng !== "" ? lngNum : DEFAULT_CENTER.lng;

  function useMyLocation() {
    setLocError(null);
    if (!("geolocation" in navigator)) {
      setLocError("This device does not support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
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
      {delError && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {delError}
        </p>
      )}

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
              id="lat" name="lat" type="number" step="any"
              placeholder="12.935100" required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng" name="lng" type="number" step="any"
              placeholder="77.535800" required
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showMap}
            onClick={() => setShowMap((v) => !v)}
          >
            <MapIcon className="size-4" aria-hidden="true" />
            {showMap ? "Hide map" : "Pick on map"}
          </Button>
        </div>
        {locError && (
          <p role="alert" className="text-sm text-destructive">{locError}</p>
        )}

        {showMap && (
          <MapPicker
            lat={mapLat}
            lng={mapLng}
            radiusM={radiusM}
            onChange={({ lat: nlat, lng: nlng }) => {
              setLat(nlat.toFixed(6));
              setLng(nlng.toFixed(6));
            }}
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="radiusM">Radius (metres)</Label>
          <Input
            id="radiusM" name="radiusM" type="number"
            min={5} max={2000} required
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
          />
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
