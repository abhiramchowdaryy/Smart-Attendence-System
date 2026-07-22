// Unit tests for lib/monthly.ts — run: node --test lib/monthly.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketByMonth, monthLabel, type AttendanceMark } from "./monthly.ts";

test("monthLabel: YYYY-MM → short month + year", () => {
  assert.equal(monthLabel("2026-07"), "Jul 2026");
  assert.equal(monthLabel("2026-01"), "Jan 2026");
  assert.equal(monthLabel("2025-12"), "Dec 2025");
});

const rows: AttendanceMark[] = [
  { entry_time: "2026-06-10T09:00:00Z", status: "present" },
  { entry_time: "2026-06-20T09:15:00Z", status: "late" },
  { entry_time: "2026-07-01T09:00:00Z", status: "present" },
  { entry_time: "2026-07-02T09:00:00Z", status: "present" },
  { entry_time: "2026-07-03T09:40:00Z", status: "partial" },
  { entry_time: "2026-07-04T09:00:00Z", status: "absent" },
];

test("bucketByMonth: groups by UTC month, ascending", () => {
  const out = bucketByMonth(rows);
  assert.deepEqual(out.map((r) => r.month), ["2026-06", "2026-07"]);
  assert.deepEqual(out.map((r) => r.label), ["Jun 2026", "Jul 2026"]);
});

test("bucketByMonth: per-status counts and totals", () => {
  const [jun, jul] = bucketByMonth(rows);
  assert.deepEqual(
    { p: jun.present, l: jun.late, pa: jun.partial, a: jun.absent, t: jun.total },
    { p: 1, l: 1, pa: 0, a: 0, t: 2 }
  );
  assert.deepEqual(
    { p: jul.present, l: jul.late, pa: jul.partial, a: jul.absent, t: jul.total },
    { p: 2, l: 0, pa: 1, a: 1, t: 4 }
  );
});

test("bucketByMonth: presentPct = present / total", () => {
  const [jun, jul] = bucketByMonth(rows);
  assert.equal(jun.presentPct, 50); // 1 of 2
  assert.equal(jul.presentPct, 50); // 2 of 4
});

test("bucketByMonth: empty input → empty output", () => {
  assert.deepEqual(bucketByMonth([]), []);
});
