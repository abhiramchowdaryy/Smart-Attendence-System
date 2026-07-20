"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidDescriptor } from "@/lib/face";

export interface EnrollResult {
  ok: boolean;
  error?: string;
}

/**
 * Store the student's enrolled 128-d face descriptor in
 * profiles.face_embedding. The descriptor is produced in the browser
 * (face-api); this action validates its shape and persists it under the
 * student's own row (RLS: "profiles: update own").
 *
 * Enrolment is FIRST-WRITE-ONLY. Silent re-enrolment would void the whole
 * anti-proxy model: a student could hand over their unlocked session, let
 * a friend overwrite the descriptor with their own face, and every later
 * identity check would pass by construction. Replacing an enrolled face is
 * therefore a staff action (see resetFaceEnrollment in the admin actions),
 * which leaves a human in the loop exactly where the trust anchor is set.
 */
export async function enrollFace(descriptor: number[]): Promise<EnrollResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!isValidDescriptor(descriptor)) {
    return {
      ok: false,
      error: "Face data was malformed — please retry enrolment.",
    };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("face_embedding")
    .eq("id", user.id)
    .maybeSingle();

  if (isValidDescriptor(existing?.face_embedding)) {
    return {
      ok: false,
      error:
        "A face is already enrolled for this account. Ask an admin to reset it before enrolling again.",
    };
  }

  // `.is(null)` makes the first-write rule atomic: two concurrent submits
  // cannot both pass the read-then-write check above, because only the row
  // still holding NULL is matched by the update.
  const { error, data: written } = await supabase
    .from("profiles")
    .update({ face_embedding: descriptor })
    .eq("id", user.id)
    .is("face_embedding", null)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!written || written.length === 0) {
    return {
      ok: false,
      error:
        "A face is already enrolled for this account. Ask an admin to reset it before enrolling again.",
    };
  }

  revalidatePath("/student/enroll-face");
  revalidatePath("/student/mark-attendance");
  return { ok: true };
}
