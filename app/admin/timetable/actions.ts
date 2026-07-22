"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TimetableState {
  error?: string;
  message?: string;
}

async function requireAdmin() {
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
  if (!profile || profile.role !== "admin") {
    return { supabase, user: null, error: "Admin access required." };
  }
  return { supabase, user, error: null };
}

/** Add one weekly timetable slot. */
export async function addTimetableSlot(
  _prev: TimetableState,
  formData: FormData
): Promise<TimetableState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const courseCode = String(formData.get("courseCode") ?? "").trim();
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const section = String(formData.get("section") ?? "").trim() || null;

  if (!courseCode) return { error: "Choose a course." };
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 6) {
    return { error: "Choose a weekday (Mon–Sat)." };
  }
  if (!startTime || !endTime) return { error: "Set the start and end time." };
  if (endTime <= startTime) return { error: "End time must be after the start time." };

  const { error: insErr } = await supabase.from("timetable").insert({
    course_code: courseCode,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    section,
  });
  if (insErr) {
    if (insErr.code === "23505") {
      return { error: "That course already has a slot at that time on that day." };
    }
    return { error: insErr.message };
  }

  revalidatePath("/admin/timetable");
  return { message: "Slot added to the timetable." };
}

export async function deleteTimetableSlot(id: string): Promise<TimetableState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const { error: delErr } = await supabase.from("timetable").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/admin/timetable");
  return { message: "Slot removed." };
}
