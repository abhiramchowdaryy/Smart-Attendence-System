"use client";

import { useEffect, useState } from "react";
import { distanceMeters, type LatLng } from "@/lib/geo";

export type GeofenceState =
  | { status: "unsupported" }
  | { status: "seeking" }
  | { status: "denied"; message: string }
  | {
      status: "inside" | "outside";
      distance: number;
      accuracy: number;
      coords: LatLng;
    };

/**
 * Live geofence tracking for UX feedback (green/red chip, distance).
 * Watches position so walking toward the room updates in real time.
 * The server action independently re-validates coordinates — this hook
 * is presentation, not security.
 */
export function useGeofence(
  center: LatLng,
  radiusM: number,
  highAccuracy: boolean = true
): GeofenceState {
  const [state, setState] = useState<GeofenceState>({ status: "seeking" });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setState({ status: "unsupported" });
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const d = distanceMeters(center, coords);
        setState({
          status: d <= radiusM ? "inside" : "outside",
          distance: Math.round(d),
          accuracy: Math.round(pos.coords.accuracy),
          coords,
        });
      },
      (err) =>
        setState({
          status: "denied",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission denied — allow location access to mark attendance."
              : err.message,
        }),
      { enableHighAccuracy: highAccuracy, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [center.lat, center.lng, radiusM, highAccuracy]);

  return state;
}
