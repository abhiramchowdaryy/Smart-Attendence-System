"use client";

import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  GraduationCap,
  BookOpenCheck,
  Layers,
  XCircle,
  Sigma,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  computeCourseResults,
  computeSemesters,
  computeCgpa,
  orderedAssessmentNames,
  type MarkRow,
  type CourseMeta,
} from "@/lib/results";
import { KpiCard } from "@/components/kpi-card";
import { PageSkeleton } from "@/components/page-skeleton";
import { SectionError } from "@/components/section-error";
import { PageTitle } from "@/src/page-title";
import { GsapReveal } from "@/components/gsap-reveal";
import { GradeDial } from "@/components/charts/grade-dial";
import { GradeBadge } from "@/components/grade-badge";
import { ExportMenu } from "@/components/export-menu";
import type { ExportColumn, ExportRow } from "@/lib/export";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StudentResults() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const sem = searchParams.get("sem") ?? undefined;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["student-results", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const supabase = createClient();
      // Own marks (RLS scopes to own rows) + course metadata for credits/sem.
      const [{ data: markRows }, { data: courseRows }] = await Promise.all([
        supabase
          .from("marks")
          .select("course, assessment, score, max_score")
          .eq("student_id", profile!.id)
          .returns<MarkRow[]>(),
        supabase
          .from("courses")
          .select("code, name, credits, semester")
          .returns<CourseMeta[]>(),
      ]);
      return { markRows: markRows ?? [], courseRows: courseRows ?? [] };
    },
  });

  if (!profile || isLoading) return <PageSkeleton />;
  if (isError || !data)
    return (
      <SectionError
        error={new Error("Could not load your results.")}
        reset={() => refetch()}
      />
    );

  const results = computeCourseResults(data.markRows, data.courseRows);
  const semesters = computeSemesters(results);
  const cgpa = computeCgpa(results);

  const semNames = semesters.map((s) => s.semester);
  // Default to the latest semester (list is sorted ascending).
  const selectedName =
    sem && semNames.includes(sem) ? sem : semNames[semNames.length - 1] ?? null;
  const selected = semesters.find((s) => s.semester === selectedName) ?? null;

  const assessmentNames = selected
    ? orderedAssessmentNames(selected.courses)
    : [];
  const failed = selected?.courses.filter((c) => c.grade === "F") ?? [];
  const totalEarned = semesters.reduce((s, x) => s + x.creditsEarned, 0);

  // Export: the selected semester's course results, matching the table.
  const exportColumns: ExportColumn[] = [
    { key: "course", label: "Course" },
    { key: "code", label: "Code" },
    { key: "credits", label: "Credits" },
    ...assessmentNames.map((n) => ({ key: `a_${n}`, label: n })),
    { key: "total", label: "Total %" },
    { key: "grade", label: "Grade" },
  ];
  const exportRows: ExportRow[] = (selected?.courses ?? []).map((c) => {
    const row: ExportRow = {
      course: c.name,
      code: c.code,
      credits: c.credits,
      total: c.totalPct ?? "",
      grade: c.grade ?? "",
    };
    for (const n of assessmentNames) {
      const cell = c.assessments.get(n);
      row[`a_${n}`] = cell ? `${cell.score}/${cell.max}` : "";
    }
    return row;
  });

  return (
    <GsapReveal className="space-y-6">
      <PageTitle title="My Results" />
      {/* Header + semester tabs */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Results</h1>
          <p className="text-sm text-muted-foreground">
            {profile.rollNo && (
              <span className="font-mono">{profile.rollNo} · </span>
            )}
            ISA / ESA scores, grades and GPA
          </p>
        </div>

        {semNames.length > 0 && (
          <div
            className="inline-flex rounded-lg border bg-muted/40 p-1"
            role="tablist"
            aria-label="Semester"
          >
            {semNames.map((s) => (
              <Link
                key={s}
                to={`/student/results?sem=${encodeURIComponent(s)}`}
                role="tab"
                aria-selected={s === selectedName}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  s === selectedName
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

      {!selected ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No results yet — scores appear here once your faculty records
            ISA/ESA marks.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Backlog banner — only when something was failed */}
          {failed.length > 0 && (
            <div
              className="flex items-start gap-3 rounded-lg border border-status-absent/30 bg-status-absent/10 px-4 py-3"
              role="status"
            >
              <XCircle
                className="mt-0.5 size-5 shrink-0 text-status-absent"
                aria-hidden="true"
              />
              <div className="text-sm">
                <p className="font-semibold text-status-absent">
                  {failed.length} backlog{failed.length > 1 ? "s" : ""} in{" "}
                  {selected.semester}
                </p>
                <p className="text-muted-foreground">
                  F grade in {failed.map((c) => c.name).join(", ")} — credits
                  not earned until cleared.
                </p>
              </div>
            </div>
          )}

          {/* SGPA dial + KPI grid */}
          <section className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-0">
                <CardTitle>SGPA — {selected.semester}</CardTitle>
                <CardDescription>
                  Credit-weighted grade points, 10-point scale
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center pb-6 pt-4">
                <GradeDial
                  value={selected.sgpa}
                  label={`SGPA ${selected.semester}`}
                />
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-3">
              <KpiCard
                label="CGPA"
                value={cgpa !== null ? cgpa.toFixed(2) : "—"}
                sub="All semesters"
                icon={<Sigma />}
                tone={
                  cgpa === null ? "neutral" : cgpa >= 8.5 ? "present" : "neutral"
                }
              />
              <KpiCard
                label="Credits earned"
                value={`${selected.creditsEarned}/${selected.creditsRegistered}`}
                sub={selected.semester}
                icon={<Layers />}
                tone={failed.length > 0 ? "late" : "present"}
              />
              <KpiCard
                label="Total earned"
                value={String(totalEarned)}
                countTo={totalEarned}
                sub="Across all semesters"
                icon={<GraduationCap />}
              />
            </div>
          </section>

          {/* Marks table */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <BookOpenCheck
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Course results — {selected.semester}
                </CardTitle>
                <CardDescription>
                  Grade bands: S ≥ 90 · A ≥ 80 · B ≥ 70 · C ≥ 60 · D ≥ 50 ·
                  E ≥ 40 · F below 40. F earns no credits.
                </CardDescription>
              </div>
              <ExportMenu
                filename={`results-${profile.rollNo ?? "me"}-${selected.semester}`}
                title={`Results — ${selected.semester}`}
                subtitle={`${profile.fullName}${profile.rollNo ? ` · ${profile.rollNo}` : ""} · SGPA ${selected.sgpa ?? "—"}`}
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
                      <th scope="col" className="py-2 pr-4 font-medium">Credits</th>
                      {assessmentNames.map((name) => (
                        <th key={name} scope="col" className="py-2 pr-4 font-medium">
                          {name}
                        </th>
                      ))}
                      <th scope="col" className="py-2 pr-4 font-medium">Total</th>
                      <th scope="col" className="py-2 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.courses.map((c) => (
                      <tr
                        key={c.code}
                        className={cn(
                          "border-b transition-colors last:border-0 hover:bg-muted/50",
                          c.grade === "F" && "bg-status-absent/5"
                        )}
                      >
                        <td className="py-3 pr-4">
                          <div className="font-medium">{c.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {c.code}
                          </div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                          {c.credits}
                        </td>
                        {assessmentNames.map((name) => {
                          const cell = c.assessments.get(name);
                          return (
                            <td
                              key={name}
                              className="py-3 pr-4 font-mono text-xs tabular-nums"
                            >
                              {cell ? (
                                <>
                                  {cell.score}
                                  <span className="text-muted-foreground">
                                    /{cell.max}
                                  </span>
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                          {c.totalPct !== null ? `${c.totalPct}%` : "—"}
                        </td>
                        <td className="py-3">
                          <GradeBadge grade={c.grade} />
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
