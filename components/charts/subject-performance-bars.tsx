"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface SubjectDatum {
  /** Short label for the axis (course code). */
  code: string;
  /** Full course name for the tooltip. */
  name: string;
  attendancePct: number | null;
  marksPct: number | null;
}

/**
 * Attendance % vs marks % per subject — two bars per course so a student
 * sees, at a glance, where showing up and scoring diverge. Attendance uses
 * the primary hue, marks the accent hue; a dashed reference line marks the
 * 75 % eligibility floor. The table on the page is the accessible data view.
 */
export function SubjectPerformanceBars({ data }: { data: SubjectDatum[] }) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`Grouped bar chart comparing attendance and marks percentage across ${data.length} subjects.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -14, bottom: 4 }}
          barCategoryGap="24%"
          barGap={4}
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="code"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <ReferenceLine
            y={75}
            stroke="hsl(var(--status-absent))"
            strokeDasharray="5 4"
            strokeOpacity={0.7}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as SubjectDatum;
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-pop">
                  <p className="font-medium text-card-foreground">{d.name}</p>
                  <p className="text-muted-foreground">
                    Attendance{" "}
                    <span className="font-mono text-card-foreground">
                      {d.attendancePct === null ? "—" : `${d.attendancePct}%`}
                    </span>{" "}
                    · Marks{" "}
                    <span className="font-mono text-card-foreground">
                      {d.marksPct === null ? "—" : `${d.marksPct}%`}
                    </span>
                  </p>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="top"
            height={28}
            iconType="circle"
            iconSize={9}
            wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
          />
          <Bar
            dataKey="attendancePct"
            name="Attendance"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="marksPct"
            name="Marks"
            fill="hsl(var(--accent))"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
