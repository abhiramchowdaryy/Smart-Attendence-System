// ════════════════════════════════════════════════════════════════════
// Supabase Edge Function · notify-shortfall
//
// Sends an attendance-shortfall SMS to the parent (profiles.parent_phone)
// of students who are below the 75% requirement, via Twilio. Invoked from
// the faculty attendance page ("Notify parents") through a server action.
//
// Runtime: Deno (Supabase Edge Functions). Deploy:
//   supabase functions deploy notify-shortfall
//   supabase secrets set TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... \
//                        TWILIO_FROM_NUMBER=+1... [TWILIO_MESSAGING_SERVICE_SID=...]
//
// INDIA / DLT: sending SMS to Indian numbers requires a TRAI/DLT-registered
// sender (header) and a registered template. Register a template whose text
// matches buildShortfallMessage() below and send it via a Messaging Service
// configured with your DLT sender — set TWILIO_MESSAGING_SERVICE_SID.
//
// The message wording is mirrored from lib/sms.ts (the canonical copy in the
// Next app); it is inlined here so the function bundles standalone.
// ════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SHORTFALL_THRESHOLD = 75;

// ── Mirrors of lib/sms.ts (keep in sync) ─────────────────────────────
function normalizeIndianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

function buildShortfallMessage(
  studentName: string,
  courseName: string,
  officialPct: number,
): string {
  const pct = Number.isFinite(officialPct) ? Math.round(officialPct) : 0;
  return (
    `Dear Parent, your ward ${studentName} has ${pct}% attendance in ` +
    `${courseName}, below the ${SHORTFALL_THRESHOLD}% requirement. Please ` +
    `ensure regular attendance. - PES University`
  );
}

// ── Twilio ───────────────────────────────────────────────────────────
interface TwilioResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

async function sendSms(to: string, body: string): Promise<TwilioResult> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

  // Not configured → caller records the row as "queued" (dry run). This lets
  // the whole flow be demonstrated end-to-end without live Twilio credentials.
  if (!sid || !token || (!from && !messagingServiceSid)) {
    return { ok: false, error: "twilio-not-configured" };
  }

  const params = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else params.set("From", from!);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.message ?? `Twilio HTTP ${res.status}` };
  }
  return { ok: true, sid: data?.sid };
}

interface Target {
  studentId: string;
  officialPct: number;
  courseCode: string | null;
  courseName: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // ── Authenticate + authorise the caller (must be staff) ────────────
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return json({ error: "Not signed in." }, 401);

  const { data: me } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!me || (me.role !== "faculty" && me.role !== "admin")) {
    return json({ error: "Staff access required." }, 403);
  }

  let payload: { courseCode?: string; studentIds?: string[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  // Service-role client for privileged reads (parent_phone) + log writes.
  const admin = createClient(url, serviceKey);

  // ── Resolve who to notify ──────────────────────────────────────────
  const targets: Target[] = [];
  let summaryQuery = admin
    .from("attendance_summary")
    .select("student_id, course_code, course_name, official_pct, conducted");

  if (payload.courseCode) summaryQuery = summaryQuery.eq("course_code", payload.courseCode);
  if (payload.studentIds?.length) {
    summaryQuery = summaryQuery.in("student_id", payload.studentIds);
  }
  const { data: rows, error: rowsError } = await summaryQuery;
  if (rowsError) return json({ error: rowsError.message }, 500);

  for (const r of rows ?? []) {
    const pct = r.official_pct == null ? null : Number(r.official_pct);
    // Only genuine shortfalls: has data and below the threshold.
    if (Number(r.conducted) > 0 && pct !== null && pct < SHORTFALL_THRESHOLD) {
      targets.push({
        studentId: r.student_id,
        officialPct: pct,
        courseCode: r.course_code,
        courseName: r.course_name,
      });
    }
  }

  if (targets.length === 0) {
    return json({ notified: 0, queued: 0, failed: 0, message: "No shortfalls to notify." });
  }

  // ── Send + log one row per target ──────────────────────────────────
  let sent = 0;
  let queued = 0;
  let failed = 0;
  const results: Array<Record<string, unknown>> = [];

  for (const t of targets) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, parent_phone")
      .eq("id", t.studentId)
      .single();

    const phone = normalizeIndianPhone(profile?.parent_phone);
    const message = buildShortfallMessage(
      profile?.full_name ?? "your ward",
      t.courseName,
      t.officialPct,
    );

    let status: "queued" | "sent" | "failed" = "queued";
    let providerSid: string | null = null;
    let error: string | null = null;

    if (!phone) {
      status = "failed";
      error = "No valid parent phone on file.";
      failed++;
    } else {
      const result = await sendSms(phone, message);
      if (result.ok) {
        status = "sent";
        providerSid = result.sid ?? null;
        sent++;
      } else if (result.error === "twilio-not-configured") {
        status = "queued"; // dry run — flow works, no SMS actually sent
        queued++;
      } else {
        status = "failed";
        error = result.error ?? "Send failed.";
        failed++;
      }
    }

    await admin.from("sms_notifications").insert({
      student_id: t.studentId,
      parent_phone: phone ?? profile?.parent_phone ?? "unknown",
      course_code: t.courseCode,
      official_pct: t.officialPct,
      message,
      status,
      provider_sid: providerSid,
      error,
      created_by: user.id,
    });

    results.push({ studentId: t.studentId, status, error });
  }

  return json({ notified: sent, queued, failed, total: targets.length, results });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
