import type { Metadata } from "next";
import Link from "next/link";
import { Users, AlertTriangle, Percent, BookOpenCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  fetchCourseAttendance,
  isEligible,
  formatPct,
  attendedCount,
  type AttendanceSummaryRow,
} from "@/lib/attendance";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { EligibilityBadge } from "@/components/eligibility-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Course Attendance" };

interface CourseOption {
  code: string;
  name: string;
  semester: string;
}

export default async function FacultyAttendance({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  await requireRole(["faculty", "admin"]);
  const supabase = await createClient();

  // Courses that actually have enrollments to report on.
  const { data: courseRows } = await supabase
    .from("courses")
    .select("code, name, semester")
    .order("semester")
    .order("name")
    .returns<CourseOption[]>();
  const courses = courseRows ?? [];

  const { course } = await searchParams;
  const selected =
    course && courses.some((c) => c.code === course)
      ? course
      : courses[0]?.code ?? null;
  const selectedCourse = courses.find((c) => c.code === selected) ?? null;

  const rows: AttendanceSummaryRow[] = selected
    ? await fetchCourseAttendance(supabase, selected)
    : [];

  // The view carries student_id but not names — resolve them (staff RLS).
  const ids = rows.map((r) => r.student_id);
  const nameById = new Map<string, { full_name: string; roll_no: string | null }>();
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, roll_no")
      .in("id", ids);
    for (const p of profiles ?? [])
      nameById.set(p.id, { full_name: p.full_name, roll_no: p.roll_no });
  }

  // Shortfall first (lowest official % on top); "No data" sinks to the bottom.
  const sorted = [...rows].sort(
    (a, b) => (a.official_pct ?? 200) - (b.official_pct ?? 200)
  );

  const withData = rows.filter((r) => r.conducted > 0);
  const belowCount = withData.filter((r) => !isEligible(r.official_pct)).length;
  const avgOfficial =
    withData.length > 0
      ? Math.round(
          (withData.reduce((s, r) => s + (r.official_pct ?? 0), 0) /
            withData.length) *
            100
        ) / 100
      : null;

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Course Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Per-student attendance and 75% eligibility, by course.
        </p>
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No courses yet. Create courses and enroll students to see reports
            here.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Course picker */}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Course">
            {courses.map((c) => (
              <Link
                key={c.code}
                href={`/faculty/attendance?course=${encodeURIComponent(c.code)}`}
                role="tab"
                aria-selected={c.code === selected}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  c.code === selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Enrolled"
              value={String(rows.length)}
              countTo={rows.length}
              sub={selectedCourse ? selectedCourse.semester : ""}
              icon={<Users />}
            />
            <KpiCard
              label="Below 75%"
              value={String(belowCount)}
              countTo={belowCount}
              sub="Not eligible"
              icon={<AlertTriangle />}
              tone={belowCount > 0 ? "absent" : "present"}
            />
            <KpiCard
              label="Class average"
              value={avgOfficial !== null ? `${avgOfficial}%` : "—"}
              sub="Official attendance %"
              icon={<Percent />}
              tone={
                avgOfficial === null
                  ? "neutral"
                  : avgOfficial >= 75
                    ? "present"
                    : "late"
              }
            />
          </div>

          {/* Roster table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {selectedCourse?.name}
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {selected}
                </span>
              </CardTitle>
              <CardDescription>
                Students below 75% are highlighted and sorted to the top.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No students are enrolled in this course yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Attended</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Official %</th>
                        <th scope="col" className="py-2 pr-4 font-medium">Weighted %</th>
                        <th scope="col" className="py-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((r) => {
                        const p = nameById.get(r.student_id);
                        const short =
                          r.conducted > 0 && !isEligible(r.official_pct);
                        return (
                          <tr
                            key={r.student_id}
                            className={cn(
                              "border-b transition-colors last:border-0 hover:bg-muted/50",
                              short && "bg-status-absent/5"
                            )}
                          >
                            <td className="py-2.5 pr-4 font-medium">
                              {p?.full_name ?? "—"}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs">
                              {p?.roll_no ?? "—"}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                              {r.conducted === 0
                                ? "—"
                                : `${attendedCount(r)}/${r.conducted}`}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                              {formatPct(r.official_pct)}
                            </td>
                            <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                              {formatPct(r.weighted_pct)}
                            </td>
                            <td className="py-2.5">
                              <EligibilityBadge officialPct={r.official_pct} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </GsapReveal>
  );
}
