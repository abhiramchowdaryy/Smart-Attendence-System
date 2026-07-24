// ════════════════════════════════════════════════════════════════════
// Geofence containment — the authoritative server-side check.
//
// The database owns the decision via PostGIS ST_DWithin (see migration
// 0007). This module wraps the geofence_check() RPC and provides a pure
// Haversine fallback with IDENTICAL allowance semantics, so an environment
// that has not applied the PostGIS migration still enforces the fence.
//
// The only Supabase reference is `import type`, erased at runtime, so the
// pure helpers here are unit-tested with node --test.
// ════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { distanceMeters, type LatLng } from "./geo.ts";

export interface GeofenceResult {
  /** Distance from the reading to the classroom, in metres. */
  distanceM: number;
  /** Fence radius + grace — the maximum distance still counted as inside. */
  allowedM: number;
  within: boolean;
  /** Which path decided: PostGIS in the DB, or the TS Haversine fallback. */
  source: "postgis" | "haversine";
}

/**
 * Extra metres allowed beyond the fence radius: the device's reported GPS
 * accuracy, but never more than the admin-configured grace. Both the PostGIS
 * RPC and the Haversine fallback are fed this same number so they can never
 * disagree on the allowance.
 */
export function effectiveGraceM(accuracyM: number, graceCapM: number): number {
  const acc = Number.isFinite(accuracyM) ? Math.max(accuracyM, 0) : 0;
  const cap = Number.isFinite(graceCapM) ? Math.max(graceCapM, 0) : 0;
  return Math.min(acc, cap);
}

/** Pure Haversine containment — the fallback when PostGIS is unavailable. */
export function haversineWithin(
  point: LatLng,
  fence: LatLng,
  radiusM: number,
  graceM: number
): GeofenceResult {
  const distanceM = distanceMeters(point, fence);
  const allowedM = radiusM + Math.max(graceM, 0);
  return { distanceM, allowedM, within: distanceM <= allowedM, source: "haversine" };
}

interface GeofenceCheckRow {
  distance_m: number | string | null;
  allowed_m: number | string | null;
  within: boolean | null;
}

/**
 * Authoritative geofence test for a session. Prefers the PostGIS RPC; on any
 * error (extension not installed, function missing, older project) it falls
 * back to the pure Haversine check against the fence passed by the caller —
 * so the fence is always enforced, never skipped.
 */
export async function checkSessionGeofence(
  supabase: SupabaseClient,
  args: {
    sessionId: string;
    lat: number;
    lng: number;
    /** Already reduced via effectiveGraceM(). */
    graceM: number;
    /** Fence loaded alongside the session; used for the Haversine fallback. */
    fence: { lat: number; lng: number; radiusM: number };
  }
): Promise<GeofenceResult> {
  const { data, error } = await supabase.rpc("geofence_check", {
    p_session_id: args.sessionId,
    p_lat: args.lat,
    p_lng: args.lng,
    p_grace_m: args.graceM,
  });

  const row = (Array.isArray(data) ? data[0] : data) as
    | GeofenceCheckRow
    | null
    | undefined;

  if (!error && row && typeof row.within === "boolean") {
    return {
      distanceM: Number(row.distance_m),
      allowedM: Number(row.allowed_m),
      within: row.within,
      source: "postgis",
    };
  }

  return haversineWithin(
    { lat: args.lat, lng: args.lng },
    { lat: args.fence.lat, lng: args.fence.lng },
    args.fence.radiusM,
    args.graceM
  );
}
