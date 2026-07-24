"use server";

import { createClient } from "@/lib/supabase/server";

export interface NotifyResult {
  ok: boolean;
  error?: string;
  message?: string;
  /** Non-fatal deliverability caveat (e.g. DLT not configured for India). */
  warning?: string;
}

/**
 * Invokes the notify-shortfall edge function, which SMSes the parents of
 * students below 75% in a course via Twilio. Staff-gated here and again
 * inside the function (which verifies the caller's JWT + role). The server
 * SSR client forwards the signed-in user's access token to the function.
 */
export async function notifyShortfallParents(
  courseCode: string
): Promise<NotifyResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "faculty" && profile?.role !== "admin") {
    return { ok: false, error: "Staff access required." };
  }

  const { data, error } = await supabase.functions.invoke("notify-shortfall", {
    body: { courseCode },
  });

  if (error) {
    return {
      ok: false,
      error:
        "Couldn't reach the SMS service. Deploy the notify-shortfall edge function to enable parent alerts.",
    };
  }

  const notified = Number(data?.notified ?? 0);
  const queued = Number(data?.queued ?? 0);
  const failed = Number(data?.failed ?? 0);
  const total = Number(data?.total ?? 0);

  if (total === 0) {
    return { ok: true, message: "No students below 75% to notify." };
  }

  const parts: string[] = [];
  if (notified) parts.push(`${notified} sent`);
  if (queued) parts.push(`${queued} queued (Twilio not configured)`);
  if (failed) parts.push(`${failed} failed`);
  const warning = typeof data?.warning === "string" ? data.warning : undefined;
  return { ok: true, message: `Parents: ${parts.join(", ")}.`, warning };
}
