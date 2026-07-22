"use client";

import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toCsv,
  exportFilename,
  htmlCell,
  type Cell,
} from "@/lib/export";

interface ExportMenuProps {
  /** Report title, used in the filename and the print header. */
  title: string;
  columns: string[];
  rows: Cell[][];
  /** Optional sub-line for the print header (e.g. course + date). */
  subtitle?: string;
}

/**
 * Two export actions over the same rows: a CSV download that opens in
 * Excel/Sheets, and a print view the browser can "Save as PDF". No
 * third-party libraries — a Blob for CSV and a new window for print.
 */
export function ExportMenu({ title, columns, rows, subtitle }: ExportMenuProps) {
  const disabled = rows.length === 0;

  function downloadCsv() {
    const csv = toCsv(columns, rows);
    // Prepend a BOM so Excel reads UTF-8 (accented names) correctly.
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportFilename(title)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function printPdf() {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    const head = columns.map((c) => `<th>${htmlCell(c)}</th>`).join("");
    const body = rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${htmlCell(cell)}</td>`).join("")}</tr>`
      )
      .join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>${htmlCell(title)}</title>
      <style>
        * { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
        body { margin: 32px; color: #0f172a; }
        h1 { font-size: 18px; margin: 0 0 2px; }
        p.sub { margin: 0 0 16px; color: #475569; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 12px; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
        th { background: #f1f5f9; text-transform: uppercase; font-size: 10px;
             letter-spacing: .04em; color: #475569; }
        tr:nth-child(even) td { background: #f8fafc; }
        @media print { body { margin: 12mm; } }
      </style></head><body>
      <h1>${htmlCell(title)}</h1>
      ${subtitle ? `<p class="sub">${htmlCell(subtitle)}</p>` : ""}
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`);
    win.document.close();
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadCsv}
        disabled={disabled}
      >
        <FileDown className="size-4" aria-hidden="true" />
        Excel (CSV)
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={printPdf}
        disabled={disabled}
      >
        <Printer className="size-4" aria-hidden="true" />
        PDF
      </Button>
    </div>
  );
}
