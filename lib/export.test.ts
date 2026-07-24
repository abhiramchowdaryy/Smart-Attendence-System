// Unit tests for lib/export.ts — run: node --test lib/export.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toCsv,
  toPrintableHtml,
  slugifyFilename,
  type ExportColumn,
} from "./export.ts";

const columns: ExportColumn[] = [
  { key: "name", label: "Name" },
  { key: "pct", label: "Official %" },
];

test("toCsv: header + rows with CRLF endings", () => {
  const csv = toCsv(columns, [
    { name: "Asha", pct: 82 },
    { name: "Ravi", pct: null },
  ]);
  assert.equal(csv, "Name,Official %\r\nAsha,82\r\nRavi,");
});

test("toCsv: quotes fields with commas, quotes and newlines", () => {
  const csv = toCsv([{ key: "v", label: "V" }], [
    { v: 'Doe, John' },
    { v: 'say "hi"' },
    { v: "line1\nline2" },
  ]);
  assert.equal(csv, 'V\r\n"Doe, John"\r\n"say ""hi"""\r\n"line1\nline2"');
});

test("toCsv: neutralises spreadsheet formula injection", () => {
  const csv = toCsv([{ key: "v", label: "V" }], [{ v: "=SUM(A1:A2)" }]);
  // Leading quote prevents Excel from evaluating it as a formula.
  assert.equal(csv, "V\r\n'=SUM(A1:A2)");
});

test("toPrintableHtml: escapes and includes title, subtitle, rows", () => {
  const html = toPrintableHtml({
    title: "My Attendance",
    subtitle: "Sem-4",
    columns,
    rows: [{ name: "A&B <script>", pct: 90 }],
  });
  assert.match(html, /<title>My Attendance<\/title>/);
  assert.match(html, /Sem-4/);
  assert.match(html, /A&amp;B &lt;script&gt;/);
  assert.ok(!html.includes("<script>")); // no unescaped injection
});

test("slugifyFilename: safe download names", () => {
  assert.equal(slugifyFilename("My Attendance — Sem 4"), "my-attendance-sem-4");
  assert.equal(slugifyFilename("!!!"), "export");
});
