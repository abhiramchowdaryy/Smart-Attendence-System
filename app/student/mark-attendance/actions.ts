"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { distanceMeters } from "@/lib/geo";
import { euclideanDistance, isFaceMatch, isValidDescriptor } from "@/lib/face";
import { fetchGpsSettings } from "@/lib/gps-settings";
import { FACE_CONFIDENCE_MIN, firstRow } from "@/lib/utils";

export interface MarkResult {
  ok: boolean;
  error?: string;
  status?: "present" | "late";
}

/**
 * Authoritative attendance entry: the browser's geofence hook is UX only,
 * so this re-validates the coordinates server-side before inserting.
 */
export async function markEntry(input: {
  sessionId: string;
  lat: number;
  lng: number;
  accuracy: number;
  faceConfidence: number;
  /** Live 128-d face descriptor, matched server-side against enrolment. */
  descriptor: number[];
}): Promise<MarkResult> {
  const supabase = await createClient();

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

  // ── Server-side face identity check ────────────────────────────────
  // The browser produces the live descriptor, but the match decision is
  // made here against the enrolled descriptor — the client cannot assert
  // its own identity. (Producing a genuine live descriptor still relies on
  // the browser; the DeepFace service seam is the path to full hardening.)
  if (!isValidDescriptor(input.descriptor)) {
    return { ok: false, error: "Face capture was invalid — please retry." };
  }
  const { data: me } = await supabase
    .from("profiles")
    .select("face_embedding")
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

  // ── The authoritative geofence check ──────────────────────────────
  const distance = distanceMeters(
    { lat: input.lat, lng: input.lng },
    { lat: Number(fence.lat), lng: Number(fence.lng) }
  );
  const allowed =
    Number(fence.radius_m) +
    Math.min(Math.max(input.accuracy, 0), gps.accuracyGraceM);
  if (distance > allowed) {
    return {
      ok: false,
      error: `You appear to be ${Math.round(distance)} m from the classroom (limit ${Math.round(allowed)} m). Move inside the geofence and retry.`,
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

  revalidatePath("/student/dashboard");
  revalidatePath("/student/mark-attendance");
  return { ok: true, status };
}

/** Records exit time; leaving while the session is still open marks "partial". */
export async function markExit(attendanceId: string): Promise<MarkResult> {
  const supabase = await createClient();

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
      // Leaving before the session closes downgrades to "partial",
      // but a "late" entry stays late.
      ...(leftEarly && record.status === "present" ? { status: "partial" } : {}),
    })
    .eq("id", attendanceId)
    .eq("student_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/student/dashboard");
  revalidatePath("/student/mark-attendance");
  return { ok: true };
}
