import type { Metadata } from "next";
import { Sigma, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import { KpiCard } from "@/components/kpi-card";
import {
  CorrelationScatter,
  type CorrelationPoint,
} from "@/components/charts/correlation-scatter";
import { describeR, linearRegression, pearsonR } from "@/lib/stats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Performance Analysis" };

/** One pre-aggregated row per student (view: public.student_performance). */
interface PerformanceRow {
  student_id: string;
  full_name: string;
  roll_no: string | null;
  attended: number;
  assessments: number;
  marks_pct: number;
}

export default async function PerformancePage() {
  await requireRole(["faculty", "admin"]);
  const supabase = await createClient();

  // Aggregation happens in Postgres (view: student_performance, migration
  // 0006) rather than by pulling raw attendance/marks history into Node.
  // Both reads are independent, so they go out together.
  const [{ count: totalSessions }, { data: perf }] = await Promise.all([
    // Denominator: all sessions ever held.
    supabase.from("sessions").select("id", { count: "exact", head: true }),
    supabase
      .from("student_performance")
      .select("student_id, full_name, roll_no, attended, assessments, marks_pct")
      .returns<PerformanceRow[]>(),
  ]);

  const held = totalSessions ?? 0;
  const rows = (perf ?? [])
    .map((s) => ({
      name: s.full_name,
      roll: s.roll_no,
      attendancePct: held > 0 ? Math.round((s.attended / held) * 100) : 0,
      marksPct: Math.round(Number(s.marks_pct)),
      assessments: s.assessments,
    }))
    .sort((a, b) => b.attendancePct - a.attendancePct);

  const points: CorrelationPoint[] = rows.map((r) => ({
    name: r.name,
    roll: r.roll,
    x: r.attendancePct,
    y: r.marksPct,
  }));

  const r = pearsonR(points);
  const regression = linearRegression(points);

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Performance Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Does showing up correlate with scoring well? One dot per student.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Students analyzed"
          value={String(rows.length)}
          countTo={rows.length}
          sub="With at least one mark"
          icon={<Users />}
        />
        <KpiCard
          label="Correlation (r)"
          value={r === null ? "—" : r.toFixed(2)}
          sub={
            r === null
              ? "Needs 3+ students with marks"
              : describeR(r)
          }
          icon={<Sigma />}
          tone={r !== null && r >= 0.4 ? "present" : "neutral"}
        />
        <KpiCard
          label="Sessions held"
          value={String(held)}
          countTo={held}
          sub="Attendance denominator"
          icon={<TrendingUp />}
        />
      </div>

      {points.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No data to correlate yet. Record marks on the{" "}
            <span className="font-medium text-foreground">Marks</span> page and
            run a few attendance sessions — dots appear here per student.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Attendance vs average marks</CardTitle>
              <CardDescription>
                Dashed line shows the least-squares trend
                {r !== null && <> · r = {r.toFixed(2)} ({describeR(r)})</>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CorrelationScatter points={points} regression={regression} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Per-student breakdown</CardTitle>
              <CardDescription>
                The table behind the chart — sorted by attendance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Attendance</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Avg marks</th>
                      <th scope="col" className="py-2 font-medium">Assessments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.roll ?? row.name}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">{row.name}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {row.roll ?? "—"}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {row.attendancePct}%
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">
                          {row.marksPct}%
                        </td>
                        <td className="py-2.5 font-mono text-xs">
                          {row.assessments}
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
