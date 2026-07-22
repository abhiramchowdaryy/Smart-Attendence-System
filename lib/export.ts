// ════════════════════════════════════════════════════════════════════
// Report export — pure helpers (no DOM, no deps).
//
// The download/print side effects live in the client component; this
// module only builds the strings, so it unit-tests without a browser.
// CSV opens directly in Excel/Sheets; the print path (built in the
// component) uses the same rows for "Save as PDF".
// ════════════════════════════════════════════════════════════════════

export type Cell = string | number | null | undefined;

/** RFC-4180 escaping: wrap in quotes when the value has a comma, quote or newline. */
export function csvCell(value: Cell): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV document from a header row and body rows. */
export function toCsv(columns: string[], rows: Cell[][]): string {
  const lines = [columns, ...rows].map((row) => row.map(csvCell).join(","));
  // CRLF line endings — the format Excel is happiest opening.
  return lines.join("\r\n");
}

/** A filesystem-safe, timestamped filename stem, e.g. "course-attendance-2026-07-22". */
export function exportFilename(stem: string, date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  const safe = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safe}-${iso}`;
}

/** Minimal HTML escaping for the print view. */
export function htmlCell(value: Cell): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
