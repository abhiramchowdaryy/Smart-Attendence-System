"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AttendanceStatus } from "@/lib/utils";

export interface CorrectionFormState {
  error?: string;
  message?: string;
}

const STATUSES: AttendanceStatus[] = ["present", "late", "absent", "partial"];

/**
 * File a correction request against one attendance row. Faculty never edit
 * attendance directly — this creates a PENDING request an admin must
 * approve (migration 0007 enforces one open request per row via RLS + a
 * partial unique index).
 */
export async function requestCorrection(
  _prev: CorrectionFormState,
  formData: FormData
): Promise<CorrectionFormState> {
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
  if (!me || !["faculty", "admin"].includes(me.role)) {
    return { error: "Faculty or admin access required." };
  }

  const attendanceId = String(formData.get("attendanceId") ?? "");
  const toStatus = String(formData.get("toStatus") ?? "") as AttendanceStatus;
  const reason = String(formData.get("reason") ?? "").trim();

  if (!attendanceId) return { error: "Choose an attendance record." };
  if (!STATUSES.includes(toStatus)) return { error: "Choose a valid new status." };
  if (reason.length < 3) return { error: "Give a short reason for the change." };

  const { data: record, error: recErr } = await supabase
    .from("attendance")
    .select("id, status")
    .eq("id", attendanceId)
    .single();
  if (recErr || !record) return { error: "That attendance record no longer exists." };
  if (record.status === toStatus) {
    return { error: "The new status matches the current one." };
  }

  const { error } = await supabase.from("attendance_corrections").insert({
    attendance_id: attendanceId,
    requested_by: user.id,
    from_status: record.status,
    to_status: toStatus,
    reason,
  });
  if (error) {
    // 23505 = unique_violation on the one-pending-per-row index.
    if (error.code === "23505") {
      return { error: "A correction is already pending for this record." };
    }
    return { error: error.message };
  }

  revalidatePath("/faculty/corrections");
  revalidatePath("/admin/corrections");
  return { message: "Correction requested — awaiting admin approval." };
}
