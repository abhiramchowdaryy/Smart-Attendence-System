import type { Metadata } from "next";
import { Layers, AlertTriangle, Percent, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  fetchAllAttendance,
  rollupByCourse,
  isEligible,
  ELIGIBILITY_THRESHOLD,
} from "@/lib/attendance";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { ExportMenu } from "@/components/export-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Cell } from "@/lib/export";

export const metadata: Metadata = { title: "Attendance Overview" };

function pctTone(pct: number | null): string {
  if (pct === null) return "bg-muted-foreground/40";
  return pct >= ELIGIBILITY_THRESHOLD ? "bg-status-present" : "bg-status-absent";
}

export default async function AdminAttendance() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const rows = await fetchAllAttendance(supabase);
  const rollups = rollupByCourse(rows);

  // Institution KPIs.
  const courseCount = rollups.length;
  const studentsBelow = new Set(
    rows
      .filter((r) => r.conducted > 0 && !isEligible(r.official_pct))
      .map((r) => r.student_id)
  ).size;
  const coursesWithData = rollups.filter((r) => r.avgOfficialPct !== null);
  const institutionAvg =
    coursesWithData.length > 0
      ? Math.round(
          (coursesWithData.reduce((s, r) => s + (r.avgOfficialPct ?? 0), 0) /
            coursesWithData.length) *
            100
        ) / 100
      : null;
  const worst = coursesWithData[0] ?? null; // rollups are sorted worst-first

  const exportColumns = [
    "Course",
    "Code",
    "Semester",
    "Enrolled",
    "Below 75%",
    "Average %",
  ];
  const exportRows: Cell[][] = rollups.map((r) => [
    r.course_name,
    r.course_code,
    r.semester,
    r.enrolled,
    r.belowThreshold,
    r.avgOfficialPct,
  ]);

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Overview</h1>
        <p className="text-sm text-muted-foreground">
          Institution-wide attendance and 75% eligibility, by course.
        </p>
      </div>

      {rollups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No attendance data yet. Once courses have enrollments and closed
            sessions, the rollup appears here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Courses"
              value={String(courseCount)}
              countTo={courseCount}
              sub="With enrollments"
              icon={<Layers />}
            />
            <KpiCard
              label="Students below 75%"
              value={String(studentsBelow)}
              countTo={studentsBelow}
              sub="In one or more courses"
              icon={<AlertTriangle />}
              tone={studentsBelow > 0 ? "absent" : "present"}
            />
            <KpiCard
              label="Institution average"
              value={institutionAvg !== null ? `${institutionAvg}%` : "—"}
              sub="Mean of course averages"
              icon={<Percent />}
              tone={
                institutionAvg === null
                  ? "neutral"
                  : institutionAvg >= 75
                    ? "present"
                    : "late"
              }
            />
            <KpiCard
              label="Lowest course"
              value={
                worst && worst.avgOfficialPct !== null
                  ? `${worst.avgOfficialPct}%`
                  : "—"
              }
              sub={worst ? worst.course_name : "No data"}
              icon={<TrendingDown />}
              tone={
                worst && worst.avgOfficialPct !== null && worst.avgOfficialPct < 75
                  ? "absent"
                  : "neutral"
              }
            />
          </div>

          {/* Per-course rollup */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Courses</CardTitle>
                <CardDescription>
                  Lowest average attendance first. Courses with students below
                  75% are flagged.
                </CardDescription>
              </div>
              <ExportMenu
                title="Institution attendance"
                subtitle={`Exported ${new Date().toLocaleDateString()}`}
                columns={exportColumns}
                rows={exportRows}
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Course</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Sem</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Enrolled</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Below 75%</th>
                      <th scope="col" className="py-2 font-medium">Average %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rollups.map((r) => (
                      <tr
                        key={r.course_code}
                        className={cn(
                          "border-b transition-colors last:border-0 hover:bg-muted/50",
                          r.belowThreshold > 0 && "bg-status-absent/5"
                        )}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{r.course_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {r.course_code}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {r.semester}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                          {r.enrolled}
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                          {r.belowThreshold > 0 ? (
                            <span className="text-status-absent">
                              {r.belowThreshold}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-14 font-mono text-xs tabular-nums">
                              {r.avgOfficialPct !== null
                                ? `${r.avgOfficialPct}%`
                                : "No data"}
                            </span>
                            <div
                              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
                              aria-hidden="true"
                            >
                              <div
                                className={cn("h-full rounded-full", pctTone(r.avgOfficialPct))}
                                style={{ width: `${r.avgOfficialPct ?? 0}%` }}
                              />
                            </div>
                          </div>
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
