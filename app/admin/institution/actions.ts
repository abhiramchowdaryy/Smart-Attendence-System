"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface InstitutionState {
  error?: string;
  message?: string;
}

/** Admin gate shared by every action here (RLS enforces it too). */
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

// ── Departments ──────────────────────────────────────────────────────
export async function addDepartment(
  _prev: InstitutionState,
  formData: FormData
): Promise<InstitutionState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!code) return { error: "Enter a department code (e.g. CSE)." };
  if (!name) return { error: "Enter the department name." };

  const { error: insErr } = await supabase
    .from("departments")
    .insert({ code, name });
  if (insErr) {
    if (insErr.code === "23505") return { error: `Department ${code} already exists.` };
    return { error: insErr.message };
  }

  revalidatePath("/admin/institution");
  return { message: `Added ${code} — ${name}.` };
}

export async function deleteDepartment(
  id: string
): Promise<InstitutionState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const { error: delErr } = await supabase
    .from("departments")
    .delete()
    .eq("id", id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/admin/institution");
  return { message: "Department removed." };
}

// ── Holidays ─────────────────────────────────────────────────────────
export async function addHoliday(
  _prev: InstitutionState,
  formData: FormData
): Promise<InstitutionState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const day = String(formData.get("day") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: "Choose a valid date." };
  if (!name) return { error: "Name the holiday (e.g. Independence Day)." };

  const { error: insErr } = await supabase
    .from("holidays")
    .insert({ day, name });
  if (insErr) {
    if (insErr.code === "23505") return { error: "A holiday is already set for that date." };
    return { error: insErr.message };
  }

  revalidatePath("/admin/institution");
  return { message: `Added holiday: ${name}.` };
}

export async function deleteHoliday(id: string): Promise<InstitutionState> {
  const { supabase, user, error } = await requireAdmin();
  if (!user) return { error: error ?? "Not allowed." };

  const { error: delErr } = await supabase.from("holidays").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/admin/institution");
  return { message: "Holiday removed." };
}
