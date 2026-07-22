"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidDescriptor } from "@/lib/face";
import { faceServiceConfigured, representFace } from "@/lib/face-service";

export interface EnrollResult {
  ok: boolean;
  error?: string;
}

export interface EnrollInput {
  /** 128-d browser (face-api) descriptor — the always-present anchor. */
  descriptor: number[];
  /**
   * Optional still frame (data URL). Required when FACE_SERVICE_URL is set:
   * the server derives a DeepFace embedding from it so later verification runs
   * on raw pixels, not a browser-supplied descriptor.
   */
  image?: string | null;
}

/**
 * Store the student's enrolled face. The 128-d descriptor is produced in the
 * browser (face-api) and validated here; when the DeepFace service is
 * configured, a still frame is also sent so the server can compute and store
 * its own embedding (profiles.face_embedding_server) — the anchor the
 * authoritative mark-attendance check compares against.
 *
 * Enrolment is FIRST-WRITE-ONLY. Silent re-enrolment would void the whole
 * anti-proxy model: a student could hand over their unlocked session, let a
 * friend overwrite the descriptor with their own face, and every later identity
 * check would pass by construction. Replacing an enrolled face is therefore a
 * staff action (resetFaceEnrollment), which leaves a human in the loop exactly
 * where the trust anchor is set.
 */
export async function enrollFace(input: EnrollInput): Promise<EnrollResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!isValidDescriptor(input.descriptor)) {
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

  // ── Optional server-side embedding ─────────────────────────────────
  // When the DeepFace service is on, the server embedding is the anchor the
  // authoritative check uses, so enrolment must actually capture it — we do
  // not silently downgrade the trust anchor to descriptor-only if it fails.
  const update: Record<string, unknown> = { face_embedding: input.descriptor };
  if (faceServiceConfigured()) {
    if (!input.image) {
      return {
        ok: false,
        error: "Camera capture was missing — please retry enrolment.",
      };
    }
    const represented = await representFace(input.image);
    if (!represented.ok) {
      return {
        ok: false,
        error:
          represented.status === 422
            ? "Couldn't read a single clear face — face the camera in good light and retry."
            : "Face verification service is unavailable — please try again shortly.",
      };
    }
    update.face_embedding_server = represented.data.embedding;
  }

  // `.is(null)` makes the first-write rule atomic: two concurrent submits
  // cannot both pass the read-then-write check above, because only the row
  // still holding NULL is matched by the update.
  const { error, data: written } = await supabase
    .from("profiles")
    .update(update)
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
