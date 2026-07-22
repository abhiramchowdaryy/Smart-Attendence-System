// GPS / geofence policy — previously hardcoded constants, now a single
// admin-editable row (public.gps_settings). Pure types + defaults live
// here; the fetch helper is thin so both the mark-attendance action and
// the admin settings page share one source of truth.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface GpsSettings {
  /** Metres of GPS-drift tolerance beyond the geofence radius. */
  accuracyGraceM: number;
  /** Minutes after session open before an entry is marked Late. */
  lateAfterMin: number;
  /** Request high-accuracy geolocation on the client. */
  highAccuracy: boolean;
  /** Campus network IP prefixes; on-network requests bypass a weak GPS fix. */
  wifiNetworks: string[];
}

/** Used when the settings row is missing (keeps the app working). */
export const DEFAULT_GPS_SETTINGS: GpsSettings = {
  accuracyGraceM: 25,
  lateAfterMin: 10,
  highAccuracy: true,
  wifiNetworks: [],
};

export const GPS_LIMITS = {
  accuracyGraceM: { min: 0, max: 500 },
  lateAfterMin: { min: 0, max: 240 },
} as const;

interface GpsSettingsRow {
  accuracy_grace_m: number;
  late_after_min: number;
  high_accuracy: boolean;
  wifi_networks: string[] | null;
}

/** Read the single GPS policy row, falling back to defaults. */
export async function fetchGpsSettings(
  supabase: SupabaseClient
): Promise<GpsSettings> {
  const { data } = await supabase
    .from("gps_settings")
    .select("accuracy_grace_m, late_after_min, high_accuracy, wifi_networks")
    .eq("id", true)
    .maybeSingle<GpsSettingsRow>();

  if (!data) return DEFAULT_GPS_SETTINGS;
  return {
    accuracyGraceM: data.accuracy_grace_m,
    lateAfterMin: data.late_after_min,
    highAccuracy: data.high_accuracy,
    wifiNetworks: data.wifi_networks ?? [],
  };
}

/** Clamp a candidate value into its allowed range (defensive for forms). */
export function clampSetting(
  key: keyof typeof GPS_LIMITS,
  value: number
): number {
  const { min, max } = GPS_LIMITS[key];
  if (!Number.isFinite(value)) return DEFAULT_GPS_SETTINGS[key];
  return Math.min(Math.max(Math.round(value), min), max);
}
