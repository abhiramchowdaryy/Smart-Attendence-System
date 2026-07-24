import type { Metadata } from "next";
import { BookOpenCheck, CalendarDays, ListChecks, Timer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireParentView } from "@/lib/auth";
import { KpiCard } from "@/components/kpi-card";
import { StatusPill } from "@/components/status-pill";
import { GsapReveal } from "@/components/gsap-reveal";
import { AttendanceRing } from "@/components/charts/attendance-ring";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttendanceStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Parent Dashboard" };

interface AttendanceRow {
  id: string;
  entry_time: string;
  exit_time: string | null;
  duration_min: number | null;
  status: AttendanceStatus;
  sessions: { course: string } | null;
}

interface MarkRow {
  id: string;
  course: string;
  assessment: string;
  score: number;
  max_score: number;
}

export default async function ParentDashboard() {
  // The signed-in account IS the student — in parent mode we present their
  // own data read-only. RLS "read own" already scopes every query below.
  const child = await requireParentView();
  const supabase = await createClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: attRows }, { data: markRows }, { count: sessionsHeld }] =
    await Promise.all([
      supabase
        .from("attendance")
        .select(
          "id, entry_time, exit_time, duration_min, status, sessions(course)"
        )
        .eq("student_id", child.id)
        .gte("entry_time", since)
        .order("entry_time", { ascending: false })
        .returns<AttendanceRow[]>(),
      supabase
        .from("marks")
        .select("id, course, assessment, score, max_score")
        .eq("student_id", child.id)
        .order("updated_at", { ascending: false })
        .returns<MarkRow[]>(),
      supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .gte("opened_at", since),
    ]);

  const records = attRows ?? [];
  const marks = markRows ?? [];
  const held = sessionsHeld ?? 0;

  const attended = records.filter((r) => r.status !== "absent").length;
  const pct = held > 0 ? Math.round((attended / held) * 100) : null;

  const durations = records
    .map((r) => r.duration_min)
    .filter((d): d is number => d !== null);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

  const avgMarksPct =
    marks.length > 0
      ? Math.round(
          marks.reduce(
            (s, m) => s + (Number(m.score) / Number(m.max_score)) * 100,
            0
          ) / marks.length
        )
      : null;

  return (
    <GsapReveal className="space-y-6">
      {/* Child identity header */}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{child.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {child.rollNo && <span className="font-mono">{child.rollNo} · </span>}
            Attendance &amp; results — last 30 days
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Parent view · read-only
        </span>
      </div>

      {/* Attendance ring + KPIs */}
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-0">
            <CardTitle>Attendance rate</CardTitle>
            <CardDescription>Rolling 30-day window</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pb-6 pt-4">
            <AttendanceRing pct={pct} attended={attended} held={held} />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-3">
          <KpiCard
            label="Classes attended"
            value={String(attended)}
            countTo={attended}
            sub={held > 0 ? `Of ${held} held` : "No sessions yet"}
            icon={<ListChecks />}
            tone={pct === null ? "neutral" : pct >= 75 ? "present" : "absent"}
          />
          <KpiCard
            label="Sessions held"
            value={String(held)}
            countTo={held}
            sub="In the last 30 days"
            icon={<CalendarDays />}
          />
          <KpiCard
            label="Avg duration"
            value={avgDuration !== null ? `${avgDuration} min` : "—"}
            countTo={avgDuration ?? undefined}
            suffix=" min"
            sub="Per attended class"
            icon={<Timer />}
          />
          <KpiCard
            label="Avg marks"
            value={avgMarksPct !== null ? `${avgMarksPct}%` : "—"}
            countTo={avgMarksPct ?? undefined}
            suffix="%"
            sub={marks.length > 0 ? `Across ${marks.length}` : "No marks yet"}
            icon={<BookOpenCheck />}
            tone={
              avgMarksPct === null
                ? "neutral"
                : avgMarksPct >= 40
                  ? "present"
                  : "absent"
            }
          />
        </div>
      </section>

      {/* Marks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Marks
          </CardTitle>
          <CardDescription>Recorded by faculty — read-only.</CardDescription>
        </CardHeader>
        <CardContent>
          {marks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No marks recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Assessment</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Score</th>
                    <th scope="col" className="py-2 font-medium">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m) => {
                    const mp = Math.round(
                      (Number(m.score) / Number(m.max_score)) * 100
                    );
                    return (
                      <tr
                        key={m.id}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">{m.course}</td>
                        <td className="py-2.5 pr-4">{m.assessment}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {Number(m.score)}/{Number(m.max_score)}
                        </td>
                        <td className="py-2.5 font-mono text-xs">{mp}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Recent attendance</CardTitle>
          <CardDescription>
            Entry, exit and duration per class — newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No attendance records in the last 30 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Entry</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Exit</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Duration</th>
                    <th scope="col" className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 10).map((r) => (
                    <tr
                      key={r.id}
                      className="border-b transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <td className="py-2.5 pr-4 font-medium">
                        {r.sessions?.course ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {new Date(r.entry_time).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {r.exit_time
                          ? new Date(r.exit_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        {r.duration_min !== null ? `${r.duration_min} min` : "—"}
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
    </GsapReveal>
  );
}
