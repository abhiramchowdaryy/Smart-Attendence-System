"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SessionFormState {
  error?: string;
  message?: string;
}

/** Staff check shared by both actions (RLS enforces this too). */
async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["faculty", "admin"].includes(profile.role)) {
    return { supabase, user: null, error: "Faculty or admin access required." };
  }
  return { supabase, user, error: null };
}

/** Opens a class session on a geofence — students can then mark entry. */
export async function openSession(
  _prev: SessionFormState,
  formData: FormData
): Promise<SessionFormState> {
  const { supabase, user, error } = await requireStaff();
  if (!user) return { error: error ?? "Not allowed." };

  const course = String(formData.get("course") ?? "").trim();
  const geofenceId = String(formData.get("geofenceId") ?? "");
  if (!course) return { error: "Enter a course name." };
  if (!geofenceId) return { error: "Choose a classroom geofence." };

  // One live session at a time keeps the student flow unambiguous.
  const { count: openCount } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .is("closed_at", null);
  if ((openCount ?? 0) > 0) {
    return { error: "A session is already open — close it before starting another." };
  }

  const { error: insertError } = await supabase.from("sessions").insert({
    course,
    faculty_id: user.id,
    geofence_id: geofenceId,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath("/faculty/dashboard");
  revalidatePath("/student/mark-attendance");
  return { message: `Session "${course}" is open — students can mark now.` };
}

/**
 * Closes the session. Students still "in class" get their exit stamped at
 * close time (they stayed to the end, so present/late status is kept).
 */
export async function closeSession(sessionId: string): Promise<SessionFormState> {
  const { supabase, user, error } = await requireStaff();
  if (!user) return { error: error ?? "Not allowed." };

  const closedAt = new Date().toISOString();

  const { error: closeError } = await supabase
    .from("sessions")
    .update({ closed_at: closedAt })
    .eq("id", sessionId)
    .is("closed_at", null);
  if (closeError) return { error: closeError.message };

  const { error: exitError } = await supabase
    .from("attendance")
    .update({ exit_time: closedAt })
    .eq("session_id", sessionId)
    .is("exit_time", null);
  if (exitError) return { error: exitError.message };

  revalidatePath("/faculty/dashboard");
  revalidatePath("/student/mark-attendance");
  revalidatePath("/student/dashboard");
  return { message: "Session closed — open records stamped with exit time." };
}
