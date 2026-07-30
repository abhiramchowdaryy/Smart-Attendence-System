"use client";

import { createClient } from "@/lib/supabase/client";
import { checkSessionGeofence, effectiveGraceM } from "@/lib/geofence";
import { euclideanDistance, isFaceMatch, isValidDescriptor } from "@/lib/face";
import { fetchGpsSettings } from "@/lib/gps-settings";
import { FACE_CONFIDENCE_MIN, firstRow } from "@/lib/utils";
import { FACE_VERIFICATION_ENABLED } from "@/app/student/enroll-face/actions";

/** Guard: is this stored value a usable server embedding? */
function isValidServerEmbedding(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}

export interface MarkResult {
  ok: boolean;
  error?: string;
  status?: "present" | "late";
  /** The late threshold actually applied, so the UI can state it truthfully. */
  lateAfterMin?: number;
}

/**
 * Attendance entry. The browser's geofence hook is UX only, so this
 * re-validates the coordinates before inserting. Face identity is checked
 * against the enrolled descriptor and, when enabled, the live image is
 * re-verified by the `face-verify` edge function (raw pixels re-embedded
 * server-side — the authoritative identity check a forged descriptor can't
 * pass). RLS on `attendance` is the ultimate gate.
 */
export async function markEntry(input: {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  faceConfidence: number;
  /** Live 128-d face descriptor, matched against enrolment. */
  descriptor: number[];
  /** Live still frame (data URL). Sent to the face-verify edge function when
   *  server verification is enabled. */
  image?: string | null;
}): Promise<MarkResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Basic input sanity — reject nonsense coordinates outright.
  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    Math.abs(input.lat) > 90 ||
    Math.abs(input.lng) > 180
  ) {
    return { ok: false, error: "Invalid location reading." };
  }
  if (input.faceConfidence < FACE_CONFIDENCE_MIN) {
    return { ok: false, error: "Face confidence too low — try again in better lighting." };
  }

  // ── Face identity check ────────────────────────────────────────────
  if (!isValidDescriptor(input.descriptor)) {
    return { ok: false, error: "Face capture was invalid — please retry." };
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("face_embedding, face_embedding_server")
    .eq("id", user.id)
    .single();

  if (!isValidDescriptor(me?.face_embedding)) {
    return {
      ok: false,
      error: "No enrolled face found — enrol your face before marking attendance.",
    };
  }
  const faceDistance = euclideanDistance(input.descriptor, me!.face_embedding);
  if (!isFaceMatch(faceDistance)) {
    return {
      ok: false,
      error: "Face does not match your enrolment — please try again.",
    };
  }

  // ── Authoritative re-verification via the face-verify edge function ──
  // Only when verification is enabled AND a server embedding exists (students
  // enrolled before it was configured have none, and fall back to the
  // descriptor match above — non-breaking).
  if (FACE_VERIFICATION_ENABLED && isValidServerEmbedding(me!.face_embedding_server)) {
    if (!input.image) {
      return { ok: false, error: "Camera capture was missing — please retry." };
    }
    const { data: verified, error: verifyError } = await supabase.functions.invoke(
      "face-verify",
      { body: { image: input.image, referenceEmbedding: me!.face_embedding_server } }
    );
    if (verifyError || !verified) {
      return {
        ok: false,
        error:
          "Face verification service is unavailable — please try again shortly.",
      };
    }
    if (!verified.verified) {
      return {
        ok: false,
        error: "Face does not match your enrolment — please try again.",
      };
    }
  }

  // Load the session and its geofence.
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, course, opened_at, closed_at, geofences(lat, lng, radius_m)")
    .eq("id", input.sessionId)
    .single();

  if (sessionError || !session) {
    return { ok: false, error: "Session not found." };
  }
  if (session.closed_at) {
    return { ok: false, error: "This session has already been closed." };
  }

  const fence = firstRow(session.geofences);
  if (!fence) return { ok: false, error: "Session has no geofence configured." };

  // Institution GPS policy (admin-configurable), with safe defaults.
  const gps = await fetchGpsSettings(supabase);

  // ── The authoritative geofence check (PostGIS ST_DWithin) ─────────
  const graceM = effectiveGraceM(input.accuracy, gps.accuracyGraceM);
  const geo = await checkSessionGeofence(supabase, {
    sessionId: session.id,
    lat: input.lat,
    lng: input.lng,
    graceM,
    fence: {
      lat: Number(fence.lat),
      lng: Number(fence.lng),
      radiusM: Number(fence.radius_m),
    },
  });
  if (!geo.within) {
    return {
      ok: false,
      error: `You appear to be ${Math.round(geo.distanceM)} m from the classroom (limit ${Math.round(geo.allowedM)} m). Move inside the geofence and retry.`,
    };
  }

  // Late if entering well after the session opened.
  const openedAt = new Date(session.opened_at).getTime();
  const status =
    Date.now() - openedAt > gps.lateAfterMin * 60_000 ? "late" : "present";

  const { error: insertError } = await supabase.from("attendance").insert({
    session_id: session.id,
    student_id: user.id,
    status,
    face_confidence: input.faceConfidence,
    entry_lat: input.lat,
    entry_lng: input.lng,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "You have already marked entry for this session." };
    }
    return { ok: false, error: insertError.message };
  }

  return { ok: true, status, lateAfterMin: gps.lateAfterMin };
}

/** Records exit time; leaving while the session is still open marks "partial". */
export async function markExit(attendanceId: string): Promise<MarkResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: record } = await supabase
    .from("attendance")
    .select("id, status, exit_time, sessions(closed_at)")
    .eq("id", attendanceId)
    .eq("student_id", user.id)
    .single();

  if (!record) return { ok: false, error: "Attendance record not found." };
  if (record.exit_time) return { ok: false, error: "Exit already recorded." };

  const session = firstRow(record.sessions);
  const leftEarly = session && !session.closed_at;

  const { error } = await supabase
    .from("attendance")
    .update({
      exit_time: new Date().toISOString(),
      ...(leftEarly && record.status === "present" ? { status: "partial" } : {}),
    })
    .eq("id", attendanceId)
    .eq("student_id", user.id);

  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
