import type { Metadata } from "next";
import { AlertTriangle, Sigma, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { GsapReveal } from "@/components/gsap-reveal";
import { KpiCard } from "@/components/kpi-card";
import {
  CorrelationScatter,
  type CorrelationPoint,
} from "@/components/charts/correlation-scatter";
import { describeR, linearRegression, pearsonR } from "@/lib/stats";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableContainer,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Performance Analysis" };

export default async function PerformancePage() {
  await requireRole(["faculty", "admin"]);
  const supabase = await createClient();

  // Denominator: all sessions ever held.
  const { count: totalSessions } = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true });

  // Every student's attended sessions.
  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("student_id, status")
    .neq("status", "absent");

  const attendedBy = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendedBy.set(row.student_id, (attendedBy.get(row.student_id) ?? 0) + 1);
  }

  // Every student's marks.
  const { data: markRows } = await supabase
    .from("marks")
    .select("student_id, score, max_score");

  const marksBy = new Map<string, { totalPct: number; n: number }>();
  for (const row of markRows ?? []) {
    const pct = (Number(row.score) / Number(row.max_score)) * 100;
    const agg = marksBy.get(row.student_id) ?? { totalPct: 0, n: 0 };
    agg.totalPct += pct;
    agg.n += 1;
    marksBy.set(row.student_id, agg);
  }

  // Names for everyone who has at least one mark.
  const { data: students } = await supabase
    .from("profiles")
    .select("id, full_name, roll_no")
    .eq("role", "student");

  const held = totalSessions ?? 0;
  const rows = (students ?? [])
    .filter((s) => marksBy.has(s.id))
    .map((s) => {
      const marks = marksBy.get(s.id)!;
      const attended = attendedBy.get(s.id) ?? 0;
      return {
        name: s.full_name,
        roll: s.roll_no,
        attendancePct: held > 0 ? Math.round((attended / held) * 100) : 0,
        marksPct: Math.round(marks.totalPct / marks.n),
        assessments: marks.n,
      };
    })
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
                The table behind the chart — sorted by attendance. Students
                under the 75% requirement are flagged{" "}
                <span className="font-medium text-status-late-strong">
                  At risk
                </span>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableContainer className="max-h-[28rem]">
                <Table>
                  <THead sticky>
                    <Th>Student</Th>
                    <Th>Roll no</Th>
                    <Th>Attendance</Th>
                    <Th>Avg marks</Th>
                    <Th className="pr-0">Assessments</Th>
                  </THead>
                  <tbody>
                    {rows.map((row) => {
                      const atRisk = row.attendancePct < 75;
                      return (
                        <Tr key={row.roll ?? row.name}>
                          <Td className="font-medium">{row.name}</Td>
                          <Td className="font-mono text-xs">
                            {row.roll ?? "—"}
                          </Td>
                          <Td>
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-xs">
                                {row.attendancePct}%
                              </span>
                              {/* Icon + label, never color alone */}
                              {atRisk && (
                                <Badge variant="late">
                                  <AlertTriangle
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  At risk
                                </Badge>
                              )}
                            </span>
                          </Td>
                          <Td className="font-mono text-xs">
                            {row.marksPct}%
                          </Td>
                          <Td className="pr-0 font-mono text-xs">
                            {row.assessments}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </GsapReveal>
  );
}
