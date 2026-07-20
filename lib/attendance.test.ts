// Unit tests for lib/attendance.ts — run with:  node --test lib/attendance.test.ts
// Uses Node's built-in test runner + native TypeScript type-stripping
// (Node >= 22.18). No test framework dependency.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELIGIBILITY_THRESHOLD,
  STATUS_WEIGHTS,
  attendedCount,
  isEligible,
  formatPct,
  summarizeStudent,
  rollupByCourse,
  type AttendanceSummaryRow,
} from "./attendance.ts";

function row(partial: Partial<AttendanceSummaryRow>): AttendanceSummaryRow {
  return {
    student_id: "s1",
    course_code: "C1",
    course_name: "Course One",
    credits: 4,
    semester: "Sem-4",
    conducted: 0,
    present_cnt: 0,
    late_cnt: 0,
    partial_cnt: 0,
    absent_cnt: 0,
    official_pct: null,
    weighted_pct: null,
    ...partial,
  };
}

test("constants are the agreed policy", () => {
  assert.equal(ELIGIBILITY_THRESHOLD, 75);
  assert.deepEqual(STATUS_WEIGHTS, {
    present: 1,
    late: 0.5,
    partial: 0.5,
    absent: 0,
  });
});

test("isEligible boundaries at 74.9 / 75.0 / 75.1", () => {
  assert.equal(isEligible(74.9), false);
  assert.equal(isEligible(75.0), true); // at threshold = eligible
  assert.equal(isEligible(75.1), true);
});

test("isEligible treats 'No data' (null/NaN) as not eligible", () => {
  assert.equal(isEligible(null), false);
  assert.equal(isEligible(NaN), false);
});

test("formatPct renders two decimals or 'No data'", () => {
  assert.equal(formatPct(76.47), "76.47%");
  assert.equal(formatPct(100), "100.00%");
  assert.equal(formatPct(null), "No data");
  assert.equal(formatPct(NaN), "No data");
});

test("attendedCount = present + late + partial", () => {
  assert.equal(
    attendedCount(row({ present_cnt: 24, late_cnt: 2, partial_cnt: 1 })),
    27
  );
});

test("summarizeStudent: screenshot case 26/34 is eligible", () => {
  const rows = [
    row({
      course_code: "UQ24CA221B",
      conducted: 34,
      present_cnt: 24,
      late_cnt: 2,
      partial_cnt: 0,
      absent_cnt: 8,
      official_pct: 76.47,
      weighted_pct: 73.53,
    }),
  ];
  const s = summarizeStudent(rows);
  assert.equal(s.coursesWithData, 1);
  assert.equal(s.eligibleCourses, 1);
  assert.equal(s.anyShortfall, false);
  assert.equal(s.shortfallCourses.length, 0);
});

test("summarizeStudent: mixed courses flag shortfall, worst first", () => {
  const rows = [
    row({ course_code: "OK", conducted: 20, present_cnt: 18, absent_cnt: 2, official_pct: 90 }),
    row({ course_code: "LOW", conducted: 20, present_cnt: 10, absent_cnt: 10, official_pct: 50 }),
    row({ course_code: "MID", conducted: 20, present_cnt: 14, absent_cnt: 6, official_pct: 70 }),
  ];
  const s = summarizeStudent(rows);
  assert.equal(s.coursesWithData, 3);
  assert.equal(s.eligibleCourses, 1);
  assert.equal(s.anyShortfall, true);
  assert.deepEqual(
    s.shortfallCourses.map((r) => r.course_code),
    ["LOW", "MID"] // lowest official % first
  );
  assert.equal(s.worstCourse?.course_code, "LOW");
});

test("summarizeStudent: empty-denominator courses are ignored", () => {
  const rows = [
    row({ course_code: "NEW", conducted: 0, official_pct: null }),
    row({ course_code: "OK", conducted: 10, present_cnt: 8, absent_cnt: 2, official_pct: 80 }),
  ];
  const s = summarizeStudent(rows);
  assert.equal(s.coursesWithData, 1);
  assert.equal(s.overallOfficialPct, 80);
  assert.equal(s.anyShortfall, false);
});

test("summarizeStudent: all no-data → null overall, no worst course", () => {
  const s = summarizeStudent([row({ conducted: 0 }), row({ course_code: "C2", conducted: 0 })]);
  assert.equal(s.coursesWithData, 0);
  assert.equal(s.overallOfficialPct, null);
  assert.equal(s.worstCourse, null);
  assert.equal(s.anyShortfall, false);
});

test("summarizeStudent: overall % aggregates attended/conducted across courses", () => {
  const rows = [
    row({ conducted: 34, present_cnt: 24, late_cnt: 2, absent_cnt: 8 }), // 26/34
    row({ course_code: "C2", conducted: 10, present_cnt: 5, absent_cnt: 5 }), // 5/10
  ];
  // (26 + 5) / (34 + 10) = 31/44 = 70.4545… → 70.45
  assert.equal(summarizeStudent(rows).overallOfficialPct, 70.45);
});

test("rollupByCourse: aggregates per course, worst average first", () => {
  const rows = [
    // Course A: two students, 80 and 60 → avg 70, one below threshold
    row({ student_id: "s1", course_code: "A", course_name: "Alpha", conducted: 10, present_cnt: 8, official_pct: 80 }),
    row({ student_id: "s2", course_code: "A", course_name: "Alpha", conducted: 10, present_cnt: 6, official_pct: 60 }),
    // Course B: two students, 90 and 100 → avg 95, none below
    row({ student_id: "s1", course_code: "B", course_name: "Beta", conducted: 10, present_cnt: 9, official_pct: 90 }),
    row({ student_id: "s2", course_code: "B", course_name: "Beta", conducted: 10, present_cnt: 10, official_pct: 100 }),
  ];
  const rollups = rollupByCourse(rows);
  assert.deepEqual(rollups.map((r) => r.course_code), ["A", "B"]); // worst avg first
  const a = rollups[0];
  assert.equal(a.enrolled, 2);
  assert.equal(a.withData, 2);
  assert.equal(a.belowThreshold, 1);
  assert.equal(a.avgOfficialPct, 70);
  assert.equal(rollups[1].avgOfficialPct, 95);
  assert.equal(rollups[1].belowThreshold, 0);
});

test("rollupByCourse: no-data students don't skew the average", () => {
  const rows = [
    row({ student_id: "s1", course_code: "A", conducted: 10, present_cnt: 8, official_pct: 80 }),
    row({ student_id: "s2", course_code: "A", conducted: 0, official_pct: null }), // enrolled, no sessions
  ];
  const [a] = rollupByCourse(rows);
  assert.equal(a.enrolled, 2);
  assert.equal(a.withData, 1);
  assert.equal(a.avgOfficialPct, 80); // only the student with data counts
});
