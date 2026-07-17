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

  const { error } = await supabase
    .from("profiles")
    .update({ face_embedding: descriptor })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/enroll-face");
  revalidatePath("/student/mark-attendance");
  return { ok: true };
}
