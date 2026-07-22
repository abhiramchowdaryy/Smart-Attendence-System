"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EligibilityBadge } from "@/components/eligibility-badge";
import { ExportMenu } from "@/components/export-menu";
import { formatPct, isEligible } from "@/lib/attendance";
import { cn } from "@/lib/utils";
import type { Cell } from "@/lib/export";

export interface RosterRow {
  studentId: string;
  name: string;
  roll: string | null;
  attended: number;
  conducted: number;
  officialPct: number | null;
  weightedPct: number | null;
}

const EXPORT_COLUMNS = [
  "Student",
  "Roll No",
  "Attended",
  "Conducted",
  "Official %",
  "Weighted %",
  "Status",
];

function statusText(r: RosterRow): string {
  if (r.conducted === 0) return "No data";
  return isEligible(r.officialPct) ? "Eligible" : "Not eligible";
}

/**
 * Course roster with client-side search (name or roll number) and CSV/PDF
 * export of exactly what's on screen — the two faculty asks the deck
 * flagged ("Search students", "Download attendance report"). Shortfall
 * rows stay sorted to the top and tinted.
 */
export function CourseRoster({
  rows,
  courseName,
  courseCode,
}: {
  rows: RosterRow[];
  courseName: string;
  courseCode: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.roll ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const exportRows: Cell[][] = filtered.map((r) => [
    r.name,
    r.roll ?? "",
    r.conducted === 0 ? "" : r.attended,
    r.conducted,
    r.officialPct,
    r.weightedPct,
    statusText(r),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or roll no…"
            aria-label="Search students"
          />
        </div>
        <ExportMenu
          title={`${courseName} attendance`}
          subtitle={`${courseCode} · exported ${new Date().toLocaleDateString()}`}
          columns={EXPORT_COLUMNS}
          rows={exportRows}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No students are enrolled in this course yet."
            : `No students match “${query}”.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Student</th>
                <th scope="col" className="py-2 pr-4 font-medium">Roll no</th>
                <th scope="col" className="py-2 pr-4 font-medium">Attended</th>
                <th scope="col" className="py-2 pr-4 font-medium">Official %</th>
                <th scope="col" className="py-2 pr-4 font-medium">Weighted %</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const short = r.conducted > 0 && !isEligible(r.officialPct);
                return (
                  <tr
                    key={r.studentId}
                    className={cn(
                      "border-b transition-colors last:border-0 hover:bg-muted/50",
                      short && "bg-status-absent/5"
                    )}
                  >
                    <td className="py-2.5 pr-4 font-medium">{r.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">
                      {r.roll ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                      {r.conducted === 0 ? "—" : `${r.attended}/${r.conducted}`}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs tabular-nums">
                      {formatPct(r.officialPct)}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                      {formatPct(r.weightedPct)}
                    </td>
                    <td className="py-2.5">
                      <EligibilityBadge officialPct={r.officialPct} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
