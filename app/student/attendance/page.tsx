import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  fetchStudentAttendance,
  fetchStudentSemesters,
  summarizeStudent,
  isEligible,
  formatPct,
  attendedCount,
  type AttendanceSummaryRow,
} from "@/lib/attendance";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { AttendanceRing } from "@/components/charts/attendance-ring";
import { EligibilityBadge } from "@/components/eligibility-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My Attendance" };

/** Bar color mirrors the eligibility state so it is never color-only. */
function barTone(officialPct: number | null): string {
  if (officialPct === null) return "bg-muted-foreground/40";
  return isEligible(officialPct) ? "bg-status-present" : "bg-status-absent";
}

export default async function StudentAttendance({
  searchParams,
}: {
  searchParams: Promise<{ sem?: string }>;
}) {
  const profile = await requireRole(["student"]);
  const supabase = await createClient();

  const semesters = await fetchStudentSemesters(supabase, profile.id);
  const { sem } = await searchParams;
  const selected =
    sem && semesters.includes(sem) ? sem : semesters[0] ?? null;

  const rows: AttendanceSummaryRow[] = selected
    ? await fetchStudentAttendance(supabase, profile.id, selected)
    : [];

  const summary = summarizeStudent(rows);
  const withData = rows.filter((r) => r.conducted > 0);
  const totalConducted = withData.reduce((s, r) => s + r.conducted, 0);
  const totalAttended = withData.reduce((s, r) => s + attendedCount(r), 0);

  return (
    <GsapReveal className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {profile.rollNo && (
              <span className="font-mono">{profile.rollNo} · </span>
            )}
            Per-subject attendance and 75% eligibility
          </p>
        </div>

        {/* Semester selector — server-side links, no client JS. */}
        {semesters.length > 0 && (
          <div
            className="inline-flex rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Semester"
          >
            {semesters.map((s) => (
              <Link
                key={s}
                href={`/student/attendance?sem=${encodeURIComponent(s)}`}
                role="tab"
                aria-selected={s === selected}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  s === selected
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            You are not enrolled in any courses yet. Once your faculty
            enrolls you, your per-subject attendance appears here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Eligibility banner */}
          {summary.anyShortfall ? (
            <div
              className="flex items-start gap-3 rounded-lg border border-status-absent/30 bg-status-absent/10 px-4 py-3"
              role="status"
            >
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-status-absent"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-semibold text-status-absent">
                  Not eligible in {summary.shortfallCourses.length} subject
                  {summary.shortfallCourses.length > 1 ? "s" : ""}
                </p>
                <p className="text-muted-foreground">
                  Below 75% in{" "}
                  {summary.shortfallCourses.map((r) => r.course_name).join(", ")}.
                  Attend upcoming classes to recover.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-start gap-3 rounded-lg border border-status-present/30 bg-status-present/10 px-4 py-3"
              role="status"
            >
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-status-present"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-semibold text-status-present">
                  Eligible in every subject
                </p>
                <p className="text-muted-foreground">
                  You meet the 75% requirement across all {selected} courses.
                </p>
              </div>
            </div>
          )}

          {/* Overall ring + KPI grid */}
          <section className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-0">
                <CardTitle>Overall — {selected}</CardTitle>
                <CardDescription>Attended of conducted, all subjects</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center pb-6 pt-4">
                <AttendanceRing
                  pct={summary.overallOfficialPct}
                  attended={totalAttended}
                  held={totalConducted}
                />
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-3">
              <KpiCard
                label="Subjects"
                value={String(rows.length)}
                countTo={rows.length}
                sub={`${selected}`}
                icon={<Layers />}
              />
              <KpiCard
                label="Eligible"
                value={`${summary.eligibleCourses}/${summary.coursesWithData}`}
                sub="At or above 75%"
                icon={<CheckCircle2 />}
                tone={summary.anyShortfall ? "late" : "present"}
              />
              <KpiCard
                label="Shortfall"
                value={String(summary.shortfallCourses.length)}
                countTo={summary.shortfallCourses.length}
                sub="Below 75%"
                icon={<AlertTriangle />}
                tone={summary.anyShortfall ? "absent" : "present"}
              />
            </div>
          </section>

          {/* Per-course table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Subjects — {selected}
              </CardTitle>
              <CardDescription>
                Official % gates the 75% requirement; weighted % counts
                late/left-early as half.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Credits</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Attended</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Official %</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Weighted %</th>
                      <th scope="col" className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.course_code}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{r.course_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.course_code}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs">
                          {Number(r.credits)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                          {r.conducted === 0
                            ? "—"
                            : `${attendedCount(r)}/${r.conducted}`}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="w-14 font-mono text-xs tabular-nums">
                              {formatPct(r.official_pct)}
                            </span>
                            <div
                              className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
                              aria-hidden="true"
                            >
                              <div
                                className={cn("h-full rounded-full", barTone(r.official_pct))}
                                style={{ width: `${r.official_pct ?? 0}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                          {formatPct(r.weighted_pct)}
                        </td>
                        <td className="py-3">
                          <EligibilityBadge officialPct={r.official_pct} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </GsapReveal>
  );
}
