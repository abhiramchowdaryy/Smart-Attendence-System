"use client";

import {
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface CorrelationPoint {
  name: string;
  roll: string | null;
  /** Attendance % (0–100) */
  x: number;
  /** Average marks % (0–100) */
  y: number;
}

/**
 * Attendance % vs average marks % — one dot per student, with the
 * least-squares trend line. Single series in the primary hue (the card
 * title names it; no legend needed); markers ≥8px for hover targets;
 * the table on the page is the accessible data view.
 */
export function CorrelationScatter({
  points,
  regression,
}: {
  points: CorrelationPoint[];
  regression: { slope: number; intercept: number } | null;
}) {
  // Two endpoints of the trend line across the attendance domain.
  const trend =
    regression === null
      ? []
      : [0, 100].map((x) => ({
          x,
          y: Math.max(0, Math.min(100, regression.intercept + regression.slope * x)),
        }));

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`Scatter plot of attendance percentage versus average marks percentage for ${points.length} students.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 12, left: -14, bottom: 4 }}>
          <CartesianGrid stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="x"
            name="Attendance"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
            label={{
              value: "Attendance %",
              position: "insideBottom",
              offset: -2,
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Avg marks"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            cursor={{ strokeDasharray: "4 4", stroke: "hsl(var(--muted-foreground))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as CorrelationPoint;
              if (d.name === undefined) return null; // trend-line points
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-pop">
                  <p className="font-medium text-card-foreground">
                    {d.name}
                    {d.roll && (
                      <span className="ml-1 font-mono text-muted-foreground">{d.roll}</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    Attendance <span className="font-mono text-card-foreground">{d.x}%</span> ·
                    Marks <span className="font-mono text-card-foreground">{d.y}%</span>
                  </p>
                </div>
              );
            }}
          />
          {/* Trend line — recessive, dashed, drawn under the dots */}
          {trend.length === 2 && (
            <Scatter
              data={trend}
              line={{
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1.5,
                strokeDasharray: "6 4",
              }}
              shape={() => <g />}
              isAnimationActive={false}
            />
          )}
          <Scatter
            data={points}
            fill="hsl(var(--primary))"
            fillOpacity={0.85}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
