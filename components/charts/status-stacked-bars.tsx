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
import { CheckCircle2, Clock, LogOut } from "lucide-react";

export interface DayStatusDatum {
  /** Short day label, e.g. "Mon 14" */
  label: string;
  present: number;
  late: number;
  partial: number;
}

/**
 * Attendance marks per day, stacked by status (last 7 days).
 * This is a status encoding, so the reserved status colors apply —
 * and the legend pairs each color with an icon + label, never color
 * alone. Absences aren't recorded as rows, so they're not plotted.
 */
export function StatusStackedBars({ data }: { data: DayStatusDatum[] }) {
  const total = data.reduce((s, d) => s + d.present + d.late + d.partial, 0);

  return (
    <div className="space-y-3">
      {/* Legend: color + icon + label */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
        <span className="flex items-center gap-1.5 text-status-present-strong">
          <span className="size-2.5 rounded-sm bg-status-present" aria-hidden="true" />
          <CheckCircle2 className="size-3" aria-hidden="true" /> Present
        </span>
        <span className="flex items-center gap-1.5 text-status-late-strong">
          <span className="size-2.5 rounded-sm bg-status-late" aria-hidden="true" />
          <Clock className="size-3" aria-hidden="true" /> Late
        </span>
        <span className="flex items-center gap-1.5 text-status-partial-strong">
          <span className="size-2.5 rounded-sm bg-status-partial" aria-hidden="true" />
          <LogOut className="size-3" aria-hidden="true" /> Left early
        </span>
      </div>

      <div
        className="h-52 w-full"
        role="img"
        aria-label={`Attendance marks per day for the last 7 days, ${total} total, split by present, late and left-early.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as DayStatusDatum;
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-pop">
                    <p className="font-medium text-card-foreground">{label}</p>
                    <p className="text-muted-foreground">
                      Present <span className="font-mono text-card-foreground">{d.present}</span> ·
                      Late <span className="font-mono text-card-foreground">{d.late}</span> ·
                      Left early <span className="font-mono text-card-foreground">{d.partial}</span>
                    </p>
                  </div>
                );
              }}
            />
            {/* 2px surface stroke keeps stacked segments visually separated */}
            <Bar dataKey="present" stackId="day" fill="hsl(var(--status-present))" stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={30} animationDuration={900} animationEasing="ease-out" />
            <Bar dataKey="late" stackId="day" fill="hsl(var(--status-late))" stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={30} animationDuration={900} animationEasing="ease-out" />
            <Bar dataKey="partial" stackId="day" fill="hsl(var(--status-partial))" stroke="hsl(var(--card))" strokeWidth={2} maxBarSize={30} radius={[4, 4, 0, 0]} animationDuration={900} animationEasing="ease-out" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
