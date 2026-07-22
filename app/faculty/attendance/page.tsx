import type { Metadata } from "next";
import Link from "next/link";
import { Users, AlertTriangle, Percent, BookOpenCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  fetchCourseAttendance,
  isEligible,
  attendedCount,
  type AttendanceSummaryRow,
} from "@/lib/attendance";
import { KpiCard } from "@/components/kpi-card";
import { GsapReveal } from "@/components/gsap-reveal";
import { CourseRoster, type RosterRow } from "@/components/faculty/course-roster";
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

  const rosterRows: RosterRow[] = sorted.map((r) => {
    const p = nameById.get(r.student_id);
    return {
      studentId: r.student_id,
      name: p?.full_name ?? "—",
      roll: p?.roll_no ?? null,
      attended: attendedCount(r),
      conducted: r.conducted,
      officialPct: r.official_pct,
      weightedPct: r.weighted_pct,
    };
  });

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
                Search by name or roll number, and export the roster to
                Excel/CSV or PDF. Students below 75% are sorted to the top.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CourseRoster
                rows={rosterRows}
                courseName={selectedCourse?.name ?? "Course"}
                courseCode={selected ?? ""}
              />
            </CardContent>
          </Card>
        </>
      )}
    </GsapReveal>
  );
}
