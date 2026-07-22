// ════════════════════════════════════════════════════════════════════
// Monthly attendance report — pure bucketing logic.
//
// Groups marked-attendance rows into calendar months (UTC) with a status
// breakdown, so the admin "Monthly attendance" report is deterministic and
// unit-testable. Absences aren't stored as rows, so `total` here is the
// number of marks made; `presentPct` is the share of those that were a
// clean "present" (late/partial count against it).
// ════════════════════════════════════════════════════════════════════

import type { AttendanceStatus } from "./utils.ts";

export interface MonthlyRow {
  /** Sort/identity key, e.g. "2026-07". */
  month: string;
  /** Display label, e.g. "Jul 2026". */
  label: string;
  present: number;
  late: number;
  partial: number;
  absent: number;
  /** All marks in the month (present + late + partial + absent). */
  total: number;
  /** Share that were a clean "present", 0..100; null when total is 0. */
  presentPct: number | null;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-07" → "Jul 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1] ?? "?"} ${y}`;
}

export interface AttendanceMark {
  entry_time: string;
  status: AttendanceStatus;
}

/** Bucket marks into ascending months with per-status counts. */
export function bucketByMonth(rows: AttendanceMark[]): MonthlyRow[] {
  const byMonth = new Map<string, MonthlyRow>();

  for (const row of rows) {
    // First 7 chars of the ISO string → "YYYY-MM" (UTC).
    const month = new Date(row.entry_time).toISOString().slice(0, 7);
    let bucket = byMonth.get(month);
    if (!bucket) {
      bucket = {
        month,
        label: monthLabel(month),
        present: 0,
        late: 0,
        partial: 0,
        absent: 0,
        total: 0,
        presentPct: null,
      };
      byMonth.set(month, bucket);
    }
    bucket[row.status] += 1;
    bucket.total += 1;
  }

  const rowsOut = [...byMonth.values()].sort((a, b) =>
    a.month.localeCompare(b.month)
  );
  for (const b of rowsOut) {
    b.presentPct = b.total > 0 ? Math.round((100 * b.present) / b.total) : null;
  }
  return rowsOut;
}
