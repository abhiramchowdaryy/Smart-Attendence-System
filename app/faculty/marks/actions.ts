"use client";

import { createClient } from "@/lib/supabase/client";

export interface MarkFormState {
  error?: string;
  message?: string;
}

/**
 * Insert-or-update a mark for (student, course, assessment).
 * Only faculty/admin pass this gate — and marks RLS enforces the same,
 * which is the deck's "only lecturers can update marks" requirement.
 */
export async function upsertMark(
  _prev: MarkFormState,
  formData: FormData
): Promise<MarkFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!me || !["faculty", "admin"].includes(me.role)) {
    return { error: "Faculty or admin access required." };
  }

  const studentId = String(formData.get("studentId") ?? "");
  const course = String(formData.get("course") ?? "").trim();
  const assessment = String(formData.get("assessment") ?? "").trim();
  const score = Number(formData.get("score"));
  const maxScore = Number(formData.get("maxScore"));

  if (!studentId) return { error: "Choose a student." };
  if (!course) return { error: "Enter a course." };
  if (!assessment) return { error: "Enter an assessment name (e.g. ISA-1)." };
  if (!Number.isFinite(maxScore) || maxScore <= 0)
    return { error: "Max score must be greater than 0." };
  if (!Number.isFinite(score) || score < 0 || score > maxScore)
    return { error: `Score must be between 0 and ${maxScore}.` };

  const { error } = await supabase.from("marks").upsert(
    {
      student_id: studentId,
      course,
      assessment,
      score,
      max_score: maxScore,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,course,assessment" }
  );
  if (error) return { error: error.message };

  return { message: `Saved ${assessment} for the student — ${score}/${maxScore}.` };
}
