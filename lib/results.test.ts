// Unit tests for lib/results.ts — run: node --test lib/results.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gradeForPct,
  computeCourseResults,
  computeSemesters,
  computeCgpa,
  orderedAssessmentNames,
  type MarkRow,
  type CourseMeta,
} from "./results.ts";

test("gradeForPct: band boundaries", () => {
  assert.deepEqual(gradeForPct(95), { grade: "S", points: 10 });
  assert.deepEqual(gradeForPct(90), { grade: "S", points: 10 }); // at boundary
  assert.deepEqual(gradeForPct(89.99), { grade: "A", points: 9 });
  assert.deepEqual(gradeForPct(70), { grade: "B", points: 8 });
  assert.deepEqual(gradeForPct(40), { grade: "E", points: 5 });
  assert.deepEqual(gradeForPct(39.9), { grade: "F", points: 0 });
  assert.deepEqual(gradeForPct(0), { grade: "F", points: 0 });
});

const COURSES: CourseMeta[] = [
  { code: "C1", name: "Alpha", credits: 4, semester: "Sem-4" },
  { code: "C2", name: "Beta", credits: 2, semester: "Sem-4" },
  { code: "C3", name: "Gamma", credits: 3, semester: "Sem-3" },
];

function mk(course: string, assessment: string, score: number, max = 100): MarkRow {
  return { course, assessment, score, max_score: max };
}

test("computeCourseResults: totals, grade, pass state", () => {
  const marks = [
    mk("C1", "ISA-1", 36, 40),
    mk("C1", "ISA-2", 32, 40),
    mk("C1", "Assignment", 18, 20),
    mk("C1", "ESA", 82, 100), // total 168/200 = 84% → A(9)
    mk("C2", "ESA", 30, 100), // 30% → F, no credits
  ];
  const results = computeCourseResults(marks, COURSES);
  assert.equal(results.length, 2);

  const c1 = results.find((r) => r.code === "C1")!;
  assert.equal(c1.totalPct, 84);
  assert.equal(c1.grade, "A");
  assert.equal(c1.gradePoints, 9);
  assert.equal(c1.passed, true);
  assert.equal(c1.assessments.get("ISA-1")?.score, 36);

  const c2 = results.find((r) => r.code === "C2")!;
  assert.equal(c2.grade, "F");
  assert.equal(c2.passed, false);
});

test("computeSemesters: SGPA weights by credits, F earns nothing", () => {
  const marks = [
    mk("C1", "ESA", 84), // A(9), 4 credits
    mk("C2", "ESA", 30), // F(0), 2 credits
    mk("C3", "ESA", 92), // S(10), 3 credits, Sem-3
  ];
  const semesters = computeSemesters(computeCourseResults(marks, COURSES));
  assert.deepEqual(semesters.map((s) => s.semester), ["Sem-3", "Sem-4"]);

  const sem4 = semesters[1];
  // (4×9 + 2×0) / 6 = 6.0
  assert.equal(sem4.sgpa, 6);
  assert.equal(sem4.creditsRegistered, 6);
  assert.equal(sem4.creditsEarned, 4); // F forfeits C2's 2 credits

  const sem3 = semesters[0];
  assert.equal(sem3.sgpa, 10);
  assert.equal(sem3.creditsEarned, 3);
});

test("computeCgpa: credit-weighted across all semesters", () => {
  const marks = [mk("C1", "ESA", 84), mk("C2", "ESA", 30), mk("C3", "ESA", 92)];
  const cgpa = computeCgpa(computeCourseResults(marks, COURSES));
  // (4×9 + 2×0 + 3×10) / 9 = 66/9 = 7.33
  assert.equal(cgpa, 7.33);
});

test("computeCgpa: null with no graded courses", () => {
  assert.equal(computeCgpa([]), null);
});

test("zero-credit courses don't poison SGPA", () => {
  const courses: CourseMeta[] = [
    { code: "Z", name: "Zero", credits: 0, semester: "Sem-4" },
    { code: "C1", name: "Alpha", credits: 4, semester: "Sem-4" },
  ];
  const marks = [mk("Z", "ESA", 100), mk("C1", "ESA", 84)];
  const [sem] = computeSemesters(computeCourseResults(marks, courses));
  assert.equal(sem.sgpa, 9); // only C1 counts
});

test("orderedAssessmentNames: known order first, unknown appended", () => {
  const marks = [
    mk("C1", "ESA", 80),
    mk("C1", "ISA-1", 30, 40),
    mk("C1", "Quiz", 8, 10),
  ];
  const names = orderedAssessmentNames(computeCourseResults(marks, COURSES));
  assert.deepEqual(names, ["ISA-1", "ESA", "Quiz"]);
});
