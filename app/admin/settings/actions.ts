"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clampSetting } from "@/lib/gps-settings";
import { normalizePrefixes } from "@/lib/network";

export interface SettingsResult {
  ok?: boolean;
  error?: string;
}

/**
 * Persist the institution GPS policy. RLS ("gps_settings: admin writes")
 * is the real gate; values are clamped to their allowed ranges so a
 * hand-edited form cannot store nonsense.
 */
export async function updateGpsSettings(
  _prev: SettingsResult,
  formData: FormData
): Promise<SettingsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const accuracyGraceM = clampSetting(
    "accuracyGraceM",
    Number(formData.get("accuracy_grace_m"))
  );
  const lateAfterMin = clampSetting(
    "lateAfterMin",
    Number(formData.get("late_after_min"))
  );
  const highAccuracy = formData.get("high_accuracy") === "on";

  // Split the free-text field on commas/whitespace into clean IP prefixes.
  const wifiNetworks = normalizePrefixes(
    String(formData.get("wifi_networks") ?? "").split(/[\s,]+/)
  );

  const { error } = await supabase
    .from("gps_settings")
    .update({
      accuracy_grace_m: accuracyGraceM,
      late_after_min: lateAfterMin,
      high_accuracy: highAccuracy,
      wifi_networks: wifiNetworks,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", true);

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  revalidatePath("/student/mark-attendance");
  return { ok: true };
}
