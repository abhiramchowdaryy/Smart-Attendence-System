// Unit tests for lib/performance.ts — run: node --test lib/performance.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzePerformance,
  combineSubjects,
  overallAverages,
  assessmentTrend,
  riskLevel,
  improvementProbability,
  recommendedAction,
  predictPerformance,
  ATTENDANCE_GOOD,
  MARKS_SATISFACTORY,
  type SubjectPerformance,
} from "./performance.ts";
import type { AttendanceSummaryRow } from "./attendance.ts";
import type { CourseResult } from "./results.ts";

// ── analyzePerformance: the four worked examples from the PDF ──────────
test("analyzePerformance: Ex1 — 96% / 91% → excellent", () => {
  const a = analyzePerformance(96, 91);
  assert.equal(a.category, "excellent");
  assert.match(a.suggestion, /Excellent performance/);
});

test("analyzePerformance: Ex2 — 72% / 58% → at-risk (both low)", () => {
  const a = analyzePerformance(72, 58);
  assert.equal(a.category, "at-risk");
  assert.match(a.suggestion, /attendance is below the recommended/);
});

test("analyzePerformance: Ex3 — 94% / 55% → marks-focus", () => {
  const a = analyzePerformance(94, 55);
  assert.equal(a.category, "marks-focus");
  assert.match(a.suggestion, /academic performance needs improvement/);
});

test("analyzePerformance: Ex4 — 68% / 87% → attendance-focus", () => {
  const a = analyzePerformance(68, 87);
  assert.equal(a.category, "attendance-focus");
  assert.match(a.suggestion, /low attendance may impact/);
});

test("analyzePerformance: boundaries are inclusive (75 / 60 count as good)", () => {
  assert.equal(analyzePerformance(ATTENDANCE_GOOD, MARKS_SATISFACTORY).category, "excellent");
  assert.equal(analyzePerformance(74.99, 60).category, "attendance-focus");
  assert.equal(analyzePerformance(75, 59.99).category, "marks-focus");
});

test("analyzePerformance: partial and empty data", () => {
  assert.equal(analyzePerformance(null, null).category, "no-data");
  assert.equal(analyzePerformance(80, null).category, "excellent");
  assert.equal(analyzePerformance(60, null).category, "attendance-focus");
  assert.equal(analyzePerformance(null, 80).category, "marks-focus");
  assert.equal(analyzePerformance(null, 40).category, "at-risk");
});

// ── combineSubjects / overallAverages ─────────────────────────────────
function attRow(
  code: string,
  name: string,
  conducted: number,
  official: number | null
): AttendanceSummaryRow {
  return {
    student_id: "s1",
    course_code: code,
    course_name: name,
    credits: 4,
    semester: "Sem-4",
    conducted,
    present_cnt: 0,
    late_cnt: 0,
    partial_cnt: 0,
    absent_cnt: 0,
    official_pct: official,
    weighted_pct: official,
  };
}

function courseResult(code: string, name: string, totalPct: number | null): CourseResult {
  return {
    code,
    name,
    credits: 4,
    semester: "Sem-4",
    assessments: new Map(),
    totalScore: 0,
    totalMax: 0,
    totalPct,
    grade: null,
    gradePoints: null,
    passed: false,
  };
}

test("combineSubjects: merges attendance + marks by course code", () => {
  const subjects = combineSubjects(
    [attRow("DBMS", "Databases", 10, 90), attRow("JAVA", "Java", 0, null)],
    [courseResult("DBMS", "Databases", 88), courseResult("OS", "Operating Systems", 70)]
  );
  const byCode = new Map(subjects.map((s) => [s.code, s]));

  assert.deepEqual(byCode.get("DBMS"), {
    code: "DBMS",
    name: "Databases",
    attendancePct: 90,
    marksPct: 88,
  });
  // Attendance with 0 conducted → null attendance, still listed.
  assert.equal(byCode.get("JAVA")?.attendancePct, null);
  // Marks-only course appears with null attendance.
  assert.equal(byCode.get("OS")?.attendancePct, null);
  assert.equal(byCode.get("OS")?.marksPct, 70);
});

test("overallAverages: means over defined values, ignoring nulls", () => {
  const subjects: SubjectPerformance[] = [
    { code: "A", name: "A", attendancePct: 80, marksPct: 90 },
    { code: "B", name: "B", attendancePct: 60, marksPct: null },
    { code: "C", name: "C", attendancePct: null, marksPct: 50 },
  ];
  const o = overallAverages(subjects);
  assert.equal(o.attendancePct, 70); // (80+60)/2
  assert.equal(o.marksPct, 70); // (90+50)/2
});

// ── assessmentTrend ───────────────────────────────────────────────────
function withIsa(code: string, isa1: number, isa2: number): CourseResult {
  const c = courseResult(code, code, null);
  c.assessments = new Map([
    ["ISA-1", { score: isa1, max: 40 }],
    ["ISA-2", { score: isa2, max: 40 }],
  ]);
  return c;
}

test("assessmentTrend: rising ISA marks → up, falling → down, null when absent", () => {
  assert.equal(assessmentTrend([withIsa("A", 20, 32)]), "up");
  assert.equal(assessmentTrend([withIsa("A", 32, 20)]), "down");
  assert.equal(assessmentTrend([withIsa("A", 30, 30)]), "flat");
  assert.equal(assessmentTrend([courseResult("A", "A", 80)]), null);
});

// ── riskLevel / improvementProbability ────────────────────────────────
test("riskLevel: both low → High, one low → Moderate, both ok → Low", () => {
  assert.equal(riskLevel(70, 50), "High");
  assert.equal(riskLevel(70, 80), "Moderate");
  assert.equal(riskLevel(90, 50), "Moderate");
  assert.equal(riskLevel(90, 80), "Low");
});

test("improvementProbability: upward trend + good attendance is most hopeful", () => {
  assert.equal(improvementProbability(90, "up"), "High");
  assert.equal(improvementProbability(60, "up"), "Moderate");
  assert.equal(improvementProbability(60, "down"), "Low");
  assert.equal(improvementProbability(90, null), "High");
});

// ── recommendedAction ─────────────────────────────────────────────────
test("recommendedAction: names weakest attendance and weakest marks subject", () => {
  const subjects: SubjectPerformance[] = [
    { code: "DBMS", name: "DBMS", attendancePct: 60, marksPct: 85 },
    { code: "PY", name: "Python", attendancePct: 92, marksPct: 45 },
  ];
  assert.equal(
    recommendedAction(subjects),
    "Improve attendance in DBMS and increase practice in Python."
  );
});

test("recommendedAction: same subject weak on both axes folds into one ask", () => {
  const subjects: SubjectPerformance[] = [
    { code: "JAVA", name: "Java", attendancePct: 55, marksPct: 40 },
  ];
  assert.match(recommendedAction(subjects), /^Prioritise Java/);
});

test("recommendedAction: all healthy → maintain", () => {
  const subjects: SubjectPerformance[] = [
    { code: "A", name: "A", attendancePct: 90, marksPct: 80 },
  ];
  assert.match(recommendedAction(subjects), /Maintain/);
});

// ── predictPerformance: end to end ────────────────────────────────────
test("predictPerformance: assembles grade, risk, likelihood, action", () => {
  const subjects: SubjectPerformance[] = [
    { code: "DBMS", name: "DBMS", attendancePct: 68, marksPct: 88 },
    { code: "PY", name: "Python", attendancePct: 95, marksPct: 55 },
  ];
  const p = predictPerformance(subjects, 82, 88, "up");
  assert.equal(p.expectedGrade, "A"); // 88% → A band
  assert.equal(p.riskLevel, "Low"); // both averages fine
  assert.equal(p.improvementProbability, "High"); // up + good attendance
  assert.match(p.recommendedAction, /attendance in DBMS/);
  assert.match(p.recommendedAction, /practice in Python/);
});
