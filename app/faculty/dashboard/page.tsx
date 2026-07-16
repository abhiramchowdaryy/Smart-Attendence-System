import type { Metadata } from "next";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Radio,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { KpiCard } from "@/components/kpi-card";
import { StatusPill } from "@/components/status-pill";
import { GsapReveal } from "@/components/gsap-reveal";
import { OpenSessionForm } from "@/components/faculty/open-session-form";
import { CloseSessionButton } from "@/components/faculty/close-session-button";
import { AutoRefresh } from "@/components/faculty/auto-refresh";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { firstRow, startOfToday, type AttendanceStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Faculty Dashboard" };

interface RosterRow {
  id: string;
  entry_time: string;
  exit_time: string | null;
  status: AttendanceStatus;
  face_confidence: number | null;
  profiles: { full_name: string; roll_no: string | null } | null;
}

export default async function FacultyDashboard() {
  const profile = await requireRole(["faculty", "admin"]);
  const supabase = await createClient();

  // The single live session, if any.
  const { data: openSession } = await supabase
    .from("sessions")
    .select("id, course, opened_at, geofences(room_name)")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Live roster for the open session.
  let roster: RosterRow[] = [];
  if (openSession) {
    const { data } = await supabase
      .from("attendance")
      .select(
        "id, entry_time, exit_time, status, face_confidence, profiles(full_name, roll_no)"
      )
      .eq("session_id", openSession.id)
      .order("entry_time", { ascending: false })
      .returns<RosterRow[]>();
    roster = data ?? [];
  }

  // Today's institution-wide stats (staff can read all rows via RLS).
  const todayStart = startOfToday();
  const { data: todayRows } = await supabase
    .from("attendance")
    .select("id, status")
    .gte("entry_time", todayStart.toISOString());

  const today = todayRows ?? [];
  const presentToday = today.filter((r) => r.status === "present").length;
  const lateToday = today.filter((r) => r.status === "late").length;

  const { count: sessionsToday } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .gte("opened_at", todayStart.toISOString());

  // Geofences for the open-session form.
  const { data: geofences } = await supabase
    .from("geofences")
    .select("id, room_name, radius_m")
    .order("room_name");

  const fence = openSession ? firstRow(openSession.geofences) : null;

  return (
    <GsapReveal className="space-y-6">
      {/* Keep the roster fresh while a session is live */}
      {openSession && <AutoRefresh seconds={15} />}

      <div>
        <h1 className="text-2xl font-bold">
          Hello, {profile.fullName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          {openSession
            ? "A session is live — the roster below updates automatically."
            : "No live session. Open one to start collecting attendance."}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Live session"
          value={openSession ? openSession.course : "None"}
          sub={
            openSession
              ? `Since ${new Date(openSession.opened_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}${fence ? ` · ${fence.room_name}` : ""}`
              : "Open one below"
          }
          icon={<Radio />}
          tone={openSession ? "present" : "neutral"}
        />
        <KpiCard
          label="Marked (live)"
          value={String(roster.length)}
          countTo={openSession ? roster.length : undefined}
          sub={openSession ? "Students so far" : "No live session"}
          icon={<Users />}
        />
        <KpiCard
          label="Present today"
          value={String(presentToday)}
          countTo={presentToday}
          sub={`Across ${sessionsToday ?? 0} session${(sessionsToday ?? 0) === 1 ? "" : "s"}`}
          icon={<CheckCircle2 />}
          tone="present"
        />
        <KpiCard
          label="Late today"
          value={String(lateToday)}
          countTo={lateToday}
          sub="Entries after 10 min"
          icon={<Clock />}
          tone={lateToday > 0 ? "late" : "neutral"}
        />
      </div>

      {openSession ? (
        /* ── Live roster ─────────────────────────────────────────── */
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                {/* LIVE ping */}
                <span className="relative flex size-2.5" aria-hidden="true">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-status-present opacity-70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-status-present" />
                </span>
                {openSession.course} — live roster
              </CardTitle>
              <CardDescription>
                {fence ? `Room “${fence.room_name}” · ` : ""}
                Auto-refreshes every 15 s
              </CardDescription>
            </div>
            <CloseSessionButton sessionId={openSession.id} />
          </CardHeader>
          <CardContent>
            {roster.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No students have marked yet — the list fills in as entries
                arrive.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Entry</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Face conf.</th>
                      <th scope="col" className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          {r.profiles?.full_name ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {r.profiles?.roll_no ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {new Date(r.entry_time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {r.face_confidence !== null
                            ? `${Math.round(Number(r.face_confidence) * 100)}%`
                            : "—"}
                        </td>
                        <td className="py-2.5">
                          <StatusPill status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* ── Open a session ──────────────────────────────────────── */
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Open a class session</CardTitle>
              <CardDescription>
                Students can mark attendance only while a session is open,
                and only inside the room&apos;s geofence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {geofences && geofences.length > 0 ? (
                <OpenSessionForm geofences={geofences} />
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No geofences configured yet. Add one in{" "}
                  <code className="font-mono text-xs">supabase/seed.sql</code>{" "}
                  or ask your administrator.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden="true" />
                How sessions work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Open a session for your course and classroom.</p>
              <p>2. Students mark entry with face + location verification; entries after 10 minutes are flagged <strong>Late</strong>.</p>
              <p>3. Students who leave early are marked <strong>Left early</strong> when they tap exit.</p>
              <p>4. Closing the session stamps an exit time for everyone still in class.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </GsapReveal>
  );
}
