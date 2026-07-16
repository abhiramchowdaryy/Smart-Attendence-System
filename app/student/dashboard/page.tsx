import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ListChecks,
  ScanFace,
  Timer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { KpiCard } from "@/components/kpi-card";
import { StatusPill } from "@/components/status-pill";
import { GsapReveal } from "@/components/gsap-reveal";
import { AttendanceRing } from "@/components/charts/attendance-ring";
import { DurationBars, type DurationDatum } from "@/components/charts/duration-bars";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { startOfToday, type AttendanceStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Student Dashboard" };

interface AttendanceRow {
  id: string;
  entry_time: string;
  exit_time: string | null;
  duration_min: number | null;
  status: AttendanceStatus;
  sessions: { course: string } | null;
}

export default async function StudentDashboard() {
  const profile = await requireRole(["student"]);
  const supabase = await createClient();

  // Last 30 days of this student's attendance (RLS scopes to own rows).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("attendance")
    .select("id, entry_time, exit_time, duration_min, status, sessions(course)")
    .eq("student_id", profile.id)
    .gte("entry_time", since)
    .order("entry_time", { ascending: false })
    .returns<AttendanceRow[]>();

  const records = rows ?? [];

  // Total sessions held in the same window (for attendance %).
  const { count: sessionsHeld } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .gte("opened_at", since);

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

  const todayStart = startOfToday();
  const todayRecord = records.find((r) => new Date(r.entry_time) >= todayStart);

  // The student's own marks (RLS scopes to own rows).
  const { data: myMarks } = await supabase
    .from("marks")
    .select("id, course, assessment, score, max_score")
    .eq("student_id", profile.id)
    .order("updated_at", { ascending: false });

  const marks = myMarks ?? [];
  const avgMarksPct =
    marks.length > 0
      ? Math.round(
          marks.reduce(
            (s, m) => s + (Number(m.score) / Number(m.max_score)) * 100,
            0
          ) / marks.length
        )
      : null;

  // Chart data: last 10 attended sessions with a recorded duration,
  // oldest → newest so time reads left to right.
  const chartData: DurationDatum[] = records
    .filter((r) => r.duration_min !== null)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      label: new Date(r.entry_time).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      course: r.sessions?.course ?? "Class",
      minutes: r.duration_min as number,
    }));

  return (
    <GsapReveal className="space-y-6">
      {/* Greeting + CTA */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Hello, {profile.fullName.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {profile.rollNo && (
              <span className="font-mono">{profile.rollNo} · </span>
            )}
            Last 30 days at a glance
          </p>
        </div>
        <Link href="/student/mark-attendance">
          <Button variant="accent">
            <ScanFace className="size-4" aria-hidden="true" />
            Mark Attendance
          </Button>
        </Link>
      </div>

      {/* Attendance ring + KPI grid */}
      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-pop lg:col-span-2">
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
            label="Today"
            value={todayRecord ? "Marked" : "Not marked"}
            sub={
              todayRecord
                ? `Entry ${new Date(todayRecord.entry_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "No entry yet"
            }
            icon={<CalendarCheck2 />}
            tone={todayRecord ? "present" : "late"}
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
            label="Classes attended"
            value={String(attended)}
            countTo={attended}
            sub={held > 0 ? `Of ${held} held` : "No sessions yet"}
            icon={<ListChecks />}
            tone={pct === null ? "neutral" : pct >= 75 ? "present" : "absent"}
          />
        </div>
      </section>

      {/* Duration trend — only when there is enough real data to plot */}
      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Time in class</CardTitle>
            <CardDescription>
              Minutes per attended session — last {chartData.length} sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DurationBars data={chartData} />
          </CardContent>
        </Card>
      )}

      {/* My marks — the deck's student "View Marks" use case */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="size-4 text-muted-foreground" aria-hidden="true" />
              My marks
            </CardTitle>
            <CardDescription>
              Recorded by your faculty — read-only.
            </CardDescription>
          </div>
          {avgMarksPct !== null && (
            <p className="text-right">
              <span className="font-display text-2xl font-semibold">{avgMarksPct}%</span>
              <span className="block text-xs text-muted-foreground">average</span>
            </p>
          )}
        </CardHeader>
        <CardContent>
          {marks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No marks recorded yet — scores appear here once your faculty
              uploads them.
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
                    const pct = Math.round(
                      (Number(m.score) / Number(m.max_score)) * 100
                    );
                    return (
                      <tr key={m.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                        <td className="py-2.5 pr-4 font-medium">{m.course}</td>
                        <td className="py-2.5 pr-4">{m.assessment}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {Number(m.score)}/{Number(m.max_score)}
                        </td>
                        <td className="py-2.5 font-mono text-xs">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Records table (also serves as the chart's accessible table view) */}
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
              No attendance records yet. Mark your first attendance to see it
              here.
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
