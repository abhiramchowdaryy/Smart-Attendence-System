"use client";

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CourseActionState {
  error?: string;
  message?: string;
}

/**
 * Staff gate shared by the course/enrolment actions. RLS ("courses: staff
 * manage" / "enrollments: staff manage") is still the real enforcement — this
 * matches the belt-and-suspenders pattern of the other actions and returns a
 * friendly error instead of a raw RLS failure for non-staff callers.
 */
async function requireStaff(): Promise<
  | { supabase: SupabaseClient; error: null }
  | { supabase: null; error: string }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Not signed in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!me || !["faculty", "admin"].includes(me.role)) {
    return { supabase: null, error: "Faculty or admin access required." };
  }
  return { supabase, error: null };
}

/**
 * Create or update a course (upsert by code). RLS "courses: staff manage"
 * is the enforcement layer; validation here is for friendly errors.
 */
export async function upsertCourse(
  _prev: CourseActionState,
  formData: FormData
): Promise<CourseActionState> {
  const { supabase, error: authError } = await requireStaff();
  if (!supabase) return { error: authError };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const credits = Number(formData.get("credits"));
  const semester = String(formData.get("semester") ?? "").trim();

  if (!/^[A-Z0-9-]{2,20}$/.test(code)) {
    return { error: "Course code: 2–20 letters, digits or dashes (e.g. UQ24CA221B)." };
  }
  if (!name) return { error: "Enter the course name." };
  if (!Number.isFinite(credits) || credits < 0 || credits > 10) {
    return { error: "Credits must be between 0 and 10." };
  }
  if (!semester) return { error: "Enter the semester (e.g. Sem-4)." };

  const { error } = await supabase
    .from("courses")
    .upsert(
      { code, name, credits, semester },
      { onConflict: "code" }
    );

  if (error) return { error: error.message };

  return { message: `Saved ${code} — ${name} (${credits} cr, ${semester}).` };
}

/**
 * Sync one course's roster to exactly `studentIds`: enrol the missing
 * (or reactivate), deactivate the unchecked. Deactivation (not deletion)
 * preserves the original enrolled_at, so attendance history stays intact
 * if the student is re-enrolled later.
 */
export async function setEnrollments(
  courseCode: string,
  studentIds: string[]
): Promise<CourseActionState> {
  const { supabase, error: authError } = await requireStaff();
  if (!supabase) return { error: authError };

  const { data: existing, error: readError } = await supabase
    .from("enrollments")
    .select("student_id, active")
    .eq("course_code", courseCode);
  if (readError) return { error: readError.message };

  const wanted = new Set(studentIds);
  const current = new Map((existing ?? []).map((e) => [e.student_id, e.active]));

  const toInsert = studentIds.filter((id) => !current.has(id));
  const toReactivate = studentIds.filter(
    (id) => current.has(id) && current.get(id) === false
  );
  const toDeactivate = [...current.keys()].filter(
    (id) => !wanted.has(id) && current.get(id) === true
  );

  if (toInsert.length > 0) {
    const { error } = await supabase.from("enrollments").insert(
      toInsert.map((student_id) => ({ student_id, course_code: courseCode }))
    );
    if (error) return { error: error.message };
  }
  if (toReactivate.length > 0) {
    const { error } = await supabase
      .from("enrollments")
      .update({ active: true })
      .eq("course_code", courseCode)
      .in("student_id", toReactivate);
    if (error) return { error: error.message };
  }
  if (toDeactivate.length > 0) {
    const { error } = await supabase
      .from("enrollments")
      .update({ active: false })
      .eq("course_code", courseCode)
      .in("student_id", toDeactivate);
    if (error) return { error: error.message };
  }

  return {
    message: `Roster saved — ${studentIds.length} student${studentIds.length === 1 ? "" : "s"} enrolled in ${courseCode}.`,
  };
}
