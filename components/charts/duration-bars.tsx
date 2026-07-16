"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DurationDatum {
  /** Short label, e.g. "Jul 14" */
  label: string;
  course: string;
  minutes: number;
}

/**
 * Minutes-in-class per attended session (magnitude → bar form).
 * Single series in the primary hue — no legend needed, the card title
 * names it; the records table below is the accessible table view.
 * Thin bars, 4px rounded data ends, recessive grid, hover tooltip.
 */
export function DurationBars({ data }: { data: DurationDatum[] }) {
  return (
    <div className="h-48 w-full" role="img" aria-label={`Class duration for the last ${data.length} attended sessions, in minutes.`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={42}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}m`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as DurationDatum;
              return (
                <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-pop">
                  <p className="font-medium text-card-foreground">{d.course}</p>
                  <p className="text-muted-foreground">
                    {d.label} · <span className="font-mono font-medium text-card-foreground">{d.minutes} min</span>
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="minutes"
            fill="hsl(var(--primary))"
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
