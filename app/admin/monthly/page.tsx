import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { bucketByMonth, type AttendanceMark } from "@/lib/monthly";
import { GsapReveal } from "@/components/gsap-reveal";
import { KpiCard } from "@/components/kpi-card";
import { ExportMenu } from "@/components/export-menu";
import { StatusStackedBars } from "@/components/charts/status-stacked-bars";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Cell } from "@/lib/export";

export const metadata: Metadata = { title: "Monthly Report" };

export default async function AdminMonthly() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  // Marks over the last 12 months (staff RLS lets admin read all).
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const { data } = await supabase
    .from("attendance")
    .select("entry_time, status")
    .gte("entry_time", since.toISOString())
    .order("entry_time", { ascending: true })
    .returns<AttendanceMark[]>();

  const months = bucketByMonth(data ?? []);
  const chartData = months.map((m) => ({
    label: m.label,
    present: m.present,
    late: m.late,
    partial: m.partial,
  }));

  const grandTotal = months.reduce((s, m) => s + m.total, 0);
  const busiest = months.reduce<(typeof months)[number] | null>(
    (best, m) => (best === null || m.total > best.total ? m : best),
    null
  );

  const exportColumns = [
    "Month",
    "Present",
    "Late",
    "Left early",
    "Absent",
    "Total",
    "Present %",
  ];
  const exportRows: Cell[][] = months.map((m) => [
    m.label,
    m.present,
    m.late,
    m.partial,
    m.absent,
    m.total,
    m.presentPct,
  ]);

  return (
    <GsapReveal className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Monthly Report</h1>
        <p className="text-sm text-muted-foreground">
          Attendance marks per month, by status — the last 12 months.
        </p>
      </div>

      {months.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No attendance recorded in the last 12 months yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <KpiCard
              label="Months with data"
              value={String(months.length)}
              countTo={months.length}
              sub="Last 12 months"
              icon={<CalendarRange />}
            />
            <KpiCard
              label="Total marks"
              value={String(grandTotal)}
              countTo={grandTotal}
              sub="Across all months"
              icon={<CalendarRange />}
            />
            <KpiCard
              label="Busiest month"
              value={busiest ? busiest.label : "—"}
              sub={busiest ? `${busiest.total} marks` : ""}
              icon={<CalendarRange />}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Marks per month</CardTitle>
                <CardDescription>
                  Stacked by present, late and left-early. Absences aren&apos;t
                  stored as rows, so they aren&apos;t plotted.
                </CardDescription>
              </div>
              <ExportMenu
                title="Monthly attendance report"
                subtitle={`Exported ${new Date().toLocaleDateString()}`}
                columns={exportColumns}
                rows={exportRows}
              />
            </CardHeader>
            <CardContent>
              <StatusStackedBars data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Breakdown</CardTitle>
              <CardDescription>The numbers behind the chart.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="py-2 pr-4 font-medium">Month</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Present</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Late</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Left early</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Absent</th>
                      <th scope="col" className="py-2 pr-4 font-medium">Total</th>
                      <th scope="col" className="py-2 font-medium">Present %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr
                        key={m.month}
                        className="border-b transition-colors last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">{m.label}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">{m.present}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">{m.late}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">{m.partial}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">{m.absent}</td>
                        <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">{m.total}</td>
                        <td className="py-2.5 font-mono text-xs tabular-nums">
                          {m.presentPct === null ? "—" : `${m.presentPct}%`}
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
