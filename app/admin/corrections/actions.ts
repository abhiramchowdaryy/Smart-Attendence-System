"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface DecisionState {
  error?: string;
  message?: string;
}

/**
 * Approve or reject a pending correction. Approving applies the requested
 * status to the underlying attendance row (which flows through the
 * attendance_summary view into every %). Admin-only — RLS enforces the
 * same on the corrections and attendance tables.
 */
export async function decideCorrection(
  correctionId: string,
  decision: "approved" | "rejected"
): Promise<DecisionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!me || me.role !== "admin") {
    return { error: "Admin access required to approve corrections." };
  }

  const { data: correction, error: cErr } = await supabase
    .from("attendance_corrections")
    .select("id, attendance_id, to_status, state")
    .eq("id", correctionId)
    .single();
  if (cErr || !correction) return { error: "Correction not found." };
  if (correction.state !== "pending") {
    return { error: "This request has already been decided." };
  }

  // Apply the new status first so a mid-way failure never marks the
  // request approved without changing the record.
  if (decision === "approved") {
    const { error: updErr } = await supabase
      .from("attendance")
      .update({ status: correction.to_status })
      .eq("id", correction.attendance_id);
    if (updErr) return { error: updErr.message };
  }

  const { error: decideErr } = await supabase
    .from("attendance_corrections")
    .update({
      state: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", correctionId)
    .eq("state", "pending");
  if (decideErr) return { error: decideErr.message };

  revalidatePath("/admin/corrections");
  revalidatePath("/faculty/corrections");
  revalidatePath("/faculty/attendance");
  revalidatePath("/admin/attendance");
  return {
    message:
      decision === "approved"
        ? "Approved — attendance updated."
        : "Request rejected.",
  };
}
