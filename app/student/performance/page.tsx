import type { Metadata } from "next";
import Link from "next/link";
import {
  Gauge,
  GraduationCap,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  ShieldAlert,
  BookOpenCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  fetchStudentAttendance,
  fetchStudentSemesters,
  formatPct,
  type AttendanceSummaryRow,
} from "@/lib/attendance";
import {
  computeCourseResults,
  type MarkRow,
  type CourseMeta,
} from "@/lib/results";
import {
  analyzePerformance,
  assessmentTrend,
  combineSubjects,
  overallAverages,
  predictPerformance,
  type Likelihood,
  type PerfCategory,
  type RiskLevel,
} from "@/lib/performance";
import { KpiCard } from "@/components/kpi-card";
import { GradeBadge } from "@/components/grade-badge";
import { GsapReveal } from "@/components/gsap-reveal";
import {
  SubjectPerformanceBars,
  type SubjectDatum,
} from "@/components/charts/subject-performance-bars";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Performance Analysis" };

/** Tint for the AI suggestion banner, keyed off the quadrant. */
const CATEGORY_TONE: Record<
  PerfCategory,
  { border: string; bg: string; text: string; icon: typeof Sparkles }
> = {
  excellent: {
    border: "border-status-present/30",
    bg: "bg-status-present/10",
    text: "text-status-present",
    icon: Sparkles,
  },
  "marks-focus": {
    border: "border-status-late/30",
    bg: "bg-status-late/10",
    text: "text-status-late",
    icon: Lightbulb,
  },
  "attendance-focus": {
    border: "border-status-late/30",
    bg: "bg-status-late/10",
    text: "text-status-late",
    icon: Lightbulb,
  },
  "at-risk": {
    border: "border-status-absent/30",
    bg: "bg-status-absent/10",
    text: "text-status-absent",
    icon: ShieldAlert,
  },
  "no-data": {
    border: "border-border",
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    icon: Sparkles,
  },
};

const RISK_TONE: Record<RiskLevel, "present" | "late" | "absent"> = {
  Low: "present",
  Moderate: "late",
  High: "absent",
};

const LIKELIHOOD_TONE: Record<Likelihood, "present" | "late" | "neutral"> = {
  High: "present",
  Moderate: "late",
  Low: "neutral",
};

export default async function StudentPerformance({
  searchParams,
}: {
  searchParams: Promise<{ sem?: string }>;
}) {
  const profile = await requireRole(["student"]);
  const supabase = await createClient();

  const semesters = await fetchStudentSemesters(supabase, profile.id);
  const { sem } = await searchParams;
  // Default to the latest semester (list is sorted ascending).
  const selected =
    sem && semesters.includes(sem)
      ? sem
      : semesters[semesters.length - 1] ?? null;

  // Attendance for the selected semester + this student's marks and the
  // course catalogue — independent reads, issued together.
  const [attendance, { data: markRows }, { data: courseRows }] =
    await Promise.all([
      selected
        ? fetchStudentAttendance(supabase, profile.id, selected)
        : Promise.resolve<AttendanceSummaryRow[]>([]),
      supabase
        .from("marks")
        .select("course, assessment, score, max_score")
        .eq("student_id", profile.id)
        .returns<MarkRow[]>(),
      supabase
        .from("courses")
        .select("code, name, credits, semester")
        .returns<CourseMeta[]>(),
    ]);

  const allResults = computeCourseResults(markRows ?? [], courseRows ?? []);
  const results = selected
    ? allResults.filter((r) => r.semester === selected)
    : allResults;

  const subjects = combineSubjects(attendance, results);
  const { attendancePct, marksPct } = overallAverages(subjects);
  const analysis = analyzePerformance(attendancePct, marksPct);
  const trend = assessmentTrend(results);
  const prediction = predictPerformance(subjects, attendancePct, marksPct, trend);

  const chartData: SubjectDatum[] = subjects.map((s) => ({
    code: s.code,
    name: s.name,
    attendancePct: s.attendancePct,
    marksPct: s.marksPct,
  }));

  const Banner = CATEGORY_TONE[analysis.category];
  const hasData = subjects.length > 0;

  return (
    <GsapReveal className="space-y-6">
      {/* Header + semester tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Analysis</h1>
          <p className="text-sm text-muted-foreground">
            {profile.rollNo && (
              <span className="font-mono">{profile.rollNo} · </span>
            )}
            How your attendance and marks move together
          </p>
        </div>

        {semesters.length > 0 && (
          <div
            className="inline-flex rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Semester"
          >
            {semesters.map((s) => (
              <Link
                key={s}
                href={`/student/performance?sem=${encodeURIComponent(s)}`}
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

      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Your performance analysis appears once you are enrolled in
            subjects and attendance or marks are recorded.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* AI suggestion banner — the headline feature */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-4",
              Banner.border,
              Banner.bg
            )}
            role="status"
          >
            <Banner.icon
              className={cn("mt-0.5 size-5 shrink-0", Banner.text)}
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className={cn("flex items-center gap-2 font-semibold", Banner.text)}>
                {analysis.headline}
                <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  AI insight
                </span>
              </p>
              <p className="text-sm text-foreground/80">{analysis.suggestion}</p>
            </div>
          </div>

          {/* KPI grid */}
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Attendance"
              value={formatPct(attendancePct)}
              countTo={attendancePct ?? undefined}
              suffix="%"
              sub="Across subjects"
              icon={<TrendingUp />}
              tone={
                attendancePct === null
                  ? "neutral"
                  : attendancePct >= 75
                    ? "present"
                    : "absent"
              }
            />
            <KpiCard
              label="Average marks"
              value={formatPct(marksPct)}
              countTo={marksPct ?? undefined}
              suffix="%"
              sub="All assessments"
              icon={<GraduationCap />}
              tone={
                marksPct === null
                  ? "neutral"
                  : marksPct >= 60
                    ? "present"
                    : "late"
              }
            />
            <KpiCard
              label="Risk level"
              value={prediction.riskLevel}
              sub="Attendance × marks"
              icon={<ShieldAlert />}
              tone={RISK_TONE[prediction.riskLevel]}
            />
            <KpiCard
              label="Expected grade"
              value={prediction.expectedGrade ?? "—"}
              sub="Projected from marks"
              icon={<Target />}
              tone="neutral"
            />
          </section>

          {/* Prediction card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-4 text-muted-foreground" aria-hidden="true" />
                Performance prediction
              </CardTitle>
              <CardDescription>
                An estimate from your current attendance and internal-assessment
                trend — guidance, not a guarantee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Expected final grade
                  </dt>
                  <dd>
                    {prediction.expectedGrade ? (
                      <GradeBadge grade={prediction.expectedGrade} />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Risk level
                  </dt>
                  <dd>
                    <TonePill
                      label={prediction.riskLevel}
                      tone={RISK_TONE[prediction.riskLevel]}
                    />
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Improvement probability
                  </dt>
                  <dd>
                    <TonePill
                      label={prediction.improvementProbability}
                      tone={LIKELIHOOD_TONE[prediction.improvementProbability]}
                    />
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Marks trend
                  </dt>
                  <dd className="text-sm font-medium">
                    {trend === null
                      ? "—"
                      : trend === "up"
                        ? "Improving ↗"
                        : trend === "down"
                          ? "Slipping ↘"
                          : "Steady →"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex items-start gap-3 rounded-lg border bg-muted/40 px-4 py-3">
                <Lightbulb
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="font-medium">Recommended action</p>
                  <p className="text-muted-foreground">
                    {prediction.recommendedAction}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance vs marks comparison chart */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance vs marks by subject</CardTitle>
              <CardDescription>
                Two bars per subject — the dashed line is the 75% attendance
                floor. Gaps show where showing up and scoring diverge.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubjectPerformanceBars data={chartData} />
            </CardContent>
          </Card>

          {/* Subject breakdown table (accessible view of the chart) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                Subject breakdown
              </CardTitle>
              <CardDescription>
                The numbers behind the chart, per subject.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Subject</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Attendance</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Marks</th>
                      <th scope="col" className="py-2 font-medium">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s) => {
                      const gap =
                        s.attendancePct !== null && s.marksPct !== null
                          ? Math.round(s.marksPct - s.attendancePct)
                          : null;
                      return (
                        <tr
                          key={s.code}
                          className="border-b transition-colors last:border-0 hover:bg-muted/50"
                        >
                          <td className="py-3 pr-4">
                            <div className="font-medium">{s.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {s.code}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                            {formatPct(s.attendancePct)}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                            {formatPct(s.marksPct)}
                          </td>
                          <td className="py-3 font-mono text-xs tabular-nums text-muted-foreground">
                            {gap === null ? "—" : gap > 0 ? `+${gap}` : `${gap}`}
                          </td>
                        </tr>
                      );
                    })}
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

/** Small colored status pill for the prediction fields. */
function TonePill({
  label,
  tone,
}: {
  label: string;
  tone: "present" | "late" | "absent" | "neutral";
}) {
  const tones: Record<typeof tone, string> = {
    present: "bg-status-present/10 text-status-present",
    late: "bg-status-late/10 text-status-late",
    absent: "bg-status-absent/10 text-status-absent",
    neutral: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold",
        tones[tone]
      )}
    >
      {label}
    </span>
  );
}
