// Unit tests for lib/export.ts — run: node --test lib/export.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv, exportFilename, htmlCell } from "./export.ts";

test("csvCell: plain values pass through, nullish → empty", () => {
  assert.equal(csvCell("Alice"), "Alice");
  assert.equal(csvCell(42), "42");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
});

test("csvCell: quotes fields with commas, quotes or newlines", () => {
  assert.equal(csvCell("Doe, John"), '"Doe, John"');
  assert.equal(csvCell('she said "hi"'), '"she said ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
});

test("toCsv: header + rows joined with CRLF", () => {
  const csv = toCsv(
    ["Name", "Roll", "Pct"],
    [
      ["Alice", "PES1UG24CA001", 92],
      ["Bob, Jr", "PES1UG24CA002", null],
    ]
  );
  assert.equal(
    csv,
    'Name,Roll,Pct\r\nAlice,PES1UG24CA001,92\r\n"Bob, Jr",PES1UG24CA002,'
  );
});

test("exportFilename: slugs the stem and appends the ISO date", () => {
  const d = new Date("2026-07-22T10:00:00Z");
  assert.equal(exportFilename("Course Attendance", d), "course-attendance-2026-07-22");
  assert.equal(exportFilename("DBMS  //  report", d), "dbms-report-2026-07-22");
});

test("htmlCell: escapes markup", () => {
  assert.equal(htmlCell("<b>&"), "&lt;b&gt;&amp;");
  assert.equal(htmlCell(null), "");
});
