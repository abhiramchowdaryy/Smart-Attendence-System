// ════════════════════════════════════════════════════════════════════
// Export builders — pure string generation for CSV and print-to-PDF.
//
// No DOM, no React: the browser ExportMenu (components/export-menu.tsx)
// feeds already-serialized rows in and downloads / prints the result, so
// the CSV and the PDF are always the same data. Unit-tested with
// node --test.
// ════════════════════════════════════════════════════════════════════

export interface ExportColumn {
  /** Key into each row object. */
  key: string;
  /** Human header shown in the CSV / table. */
  label: string;
}

/** A row is a flat map of column key → primitive cell value. */
export type ExportRow = Record<string, string | number | null | undefined>;

/** Render a cell as a plain string ("" for null/undefined). */
function cellText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Quote a CSV field per RFC 4180 and neutralise spreadsheet formula
 * injection: a value starting with = + - @ (or a tab/CR) is prefixed with a
 * single quote so Excel/Sheets treats it as text, not a formula.
 */
function csvField(raw: string): string {
  let value = raw;
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  if (/[",\n\r]/.test(value)) {
    value = `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build an RFC 4180 CSV (CRLF line endings) from columns + rows. */
export function toCsv(columns: ExportColumn[], rows: ExportRow[]): string {
  const header = columns.map((c) => csvField(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => csvField(cellText(row[c.key]))).join(",")
  );
  return [header, ...body].join("\r\n");
}

/** Minimal HTML escape for the printable document. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PrintableOptions {
  title: string;
  /** Optional line under the title (e.g. student name · semester · date). */
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}

/**
 * A self-contained HTML document for print-to-PDF: opened in a new window,
 * printed, and closed. Styling is inline so it needs nothing from the app.
 */
export function toPrintableHtml({
  title,
  subtitle,
  columns,
  rows,
}: PrintableOptions): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => `<td>${escapeHtml(cellText(row[c.key]))}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .subtitle { color: #555; font-size: 12px; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .footer { margin-top: 16px; color: #888; font-size: 10px; }
  @media print { body { margin: 12mm; } .footer { position: fixed; bottom: 8mm; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody>
  </table>
  <p class="footer">PES Smart Attendance · ${rows.length} row${rows.length === 1 ? "" : "s"}</p>
</body>
</html>`;
}

/** Filesystem-safe slug for a download filename. */
export function slugifyFilename(raw: string): string {
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "export"
  );
}
