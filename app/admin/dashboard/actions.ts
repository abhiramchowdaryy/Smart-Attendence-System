"use client";

import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/lib/utils";

export interface AdminActionState {
  error?: string;
  message?: string;
}

/** Admin gate shared by all actions (RLS enforces this too). */
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { supabase, user: null, error: "Admin access required." };
  }
  return { supabase, user, error: null };
}

const VALID_ROLES: Role[] = ["student", "faculty", "admin"];

/** Changes a user's role. Admins cannot change their own role (lock-out guard). */
export async function setUserRole(
  userId: string,
  role: Role
): Promise<AdminActionState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  if (!VALID_ROLES.includes(role)) return { error: "Invalid role." };
  if (userId === user.id) {
    return { error: "You cannot change your own role — ask another admin." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (updateError) return { error: updateError.message };

  return { message: "Role updated." };
}

/**
 * Clears a student's enrolled face so they can enrol again.
 *
 * Face enrolment is first-write-only (see enrollFace) precisely so that the
 * identity anchor cannot be silently swapped by whoever holds the session.
 * This is the deliberate, staff-gated escape hatch for the legitimate cases
 * — a poor original capture, or a student whose appearance changed.
 */
export async function resetFaceEnrollment(
  userId: string
): Promise<AdminActionState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  // Clear both anchors: the browser descriptor and the optional server-side
  // DeepFace embedding. Leaving the latter behind would let a stale server
  // embedding keep verifying against the old face after a reset.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ face_embedding: null, face_embedding_server: null })
    .eq("id", userId);
  if (updateError) return { error: updateError.message };

  return { message: "Face enrolment reset — the student can now re-enrol." };
}

/** Creates a classroom geofence. */
export async function createGeofence(
  _prev: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const { user, supabase, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const roomName = String(formData.get("roomName") ?? "").trim();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const radiusM = Number(formData.get("radiusM"));

  if (!roomName) return { error: "Enter a room name." };
  if (!Number.isFinite(lat) || Math.abs(lat) > 90)
    return { error: "Latitude must be between -90 and 90." };
  if (!Number.isFinite(lng) || Math.abs(lng) > 180)
    return { error: "Longitude must be between -180 and 180." };
  if (!Number.isFinite(radiusM) || radiusM < 5 || radiusM > 2000)
    return { error: "Radius must be between 5 and 2000 metres." };

  const { error: insertError } = await supabase.from("geofences").insert({
    room_name: roomName,
    lat,
    lng,
    radius_m: Math.round(radiusM),
  });
  if (insertError) return { error: insertError.message };

  return { message: `Geofence "${roomName}" created.` };
}

/** Deletes a geofence — blocked by the FK if sessions already used it. */
export async function deleteGeofence(id: string): Promise<AdminActionState> {
  const { user, supabase, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const { error: deleteError } = await supabase
    .from("geofences")
    .delete()
    .eq("id", id);

  if (deleteError) {
    if (deleteError.code === "23503") {
      return {
        error:
          "This geofence has sessions attached to it and cannot be deleted (history would be lost).",
      };
    }
    return { error: deleteError.message };
  }

  return { message: "Geofence deleted." };
}
