// ════════════════════════════════════════════════════════════════════
// Academic results — pure logic (Phase 2, sub-project 3).
//
// Turns raw `marks` rows (student × course × assessment) + course
// credits into per-course totals, letter grades, grade points, and
// per-semester SGPA / overall CGPA. Framework-free and unit-tested;
// grading policy lives in one place so it is trivially changeable.
// ════════════════════════════════════════════════════════════════════

/** 10-point letter-grade bands (percentage lower bounds), best first. */
export const GRADE_BANDS = [
  { grade: "S", points: 10, minPct: 90 },
  { grade: "A", points: 9, minPct: 80 },
  { grade: "B", points: 8, minPct: 70 },
  { grade: "C", points: 7, minPct: 60 },
  { grade: "D", points: 6, minPct: 50 },
  { grade: "E", points: 5, minPct: 40 },
  { grade: "F", points: 0, minPct: 0 },
] as const;

export type LetterGrade = (typeof GRADE_BANDS)[number]["grade"];

/** Preferred assessment display order (unknown names go last, as-is). */
export const ASSESSMENT_ORDER = ["ISA-1", "ISA-2", "Assignment", "ESA"] as const;

export interface MarkRow {
  course: string;
  assessment: string;
  score: number;
  max_score: number;
}

export interface CourseMeta {
  code: string;
  name: string;
  credits: number;
  semester: string;
}

export interface CourseResult {
  code: string;
  name: string;
  credits: number;
  semester: string;
  /** assessment → "score/max" cells, in ASSESSMENT_ORDER. */
  assessments: Map<string, { score: number; max: number }>;
  totalScore: number;
  totalMax: number;
  /** 0..100, null when no marks at all. */
  totalPct: number | null;
  grade: LetterGrade | null;
  gradePoints: number | null;
  /** F earns no credits. */
  passed: boolean;
}

export interface SemesterResult {
  semester: string;
  courses: CourseResult[];
  /** Σ(credits × gp) / Σcredits over graded courses; null if none. */
  sgpa: number | null;
  creditsRegistered: number;
  creditsEarned: number;
}

/** Letter grade for a 0..100 percentage. */
export function gradeForPct(pct: number): { grade: LetterGrade; points: number } {
  for (const band of GRADE_BANDS) {
    if (pct >= band.minPct) return { grade: band.grade, points: band.points };
  }
  // Unreachable (last band is 0), but keeps TS + callers safe.
  const f = GRADE_BANDS[GRADE_BANDS.length - 1];
  return { grade: f.grade, points: f.points };
}

/** Round to 2 decimals, avoiding float drift. */
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Fold raw marks + course metadata into per-course results. */
export function computeCourseResults(
  marks: MarkRow[],
  courses: CourseMeta[]
): CourseResult[] {
  const metaByCode = new Map(courses.map((c) => [c.code, c]));
  const byCourse = new Map<string, MarkRow[]>();
  for (const m of marks) {
    const list = byCourse.get(m.course);
    if (list) list.push(m);
    else byCourse.set(m.course, [m]);
  }

  const results: CourseResult[] = [];
  for (const [code, rows] of byCourse) {
    const meta = metaByCode.get(code);
    const assessments = new Map<string, { score: number; max: number }>();
    let totalScore = 0;
    let totalMax = 0;
    for (const row of rows) {
      assessments.set(row.assessment, {
        score: Number(row.score),
        max: Number(row.max_score),
      });
      totalScore += Number(row.score);
      totalMax += Number(row.max_score);
    }
    const totalPct = totalMax > 0 ? r2((100 * totalScore) / totalMax) : null;
    const graded = totalPct !== null ? gradeForPct(totalPct) : null;
    results.push({
      code,
      name: meta?.name ?? code,
      credits: Number(meta?.credits ?? 0),
      semester: meta?.semester ?? "Unknown",
      assessments,
      totalScore: r2(totalScore),
      totalMax: r2(totalMax),
      totalPct,
      grade: graded?.grade ?? null,
      gradePoints: graded?.points ?? null,
      passed: graded !== null && graded.grade !== "F",
    });
  }
  // Stable, readable order: by course name.
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/** Group course results into semesters with SGPA + credit totals. */
export function computeSemesters(results: CourseResult[]): SemesterResult[] {
  const bySem = new Map<string, CourseResult[]>();
  for (const r of results) {
    const list = bySem.get(r.semester);
    if (list) list.push(r);
    else bySem.set(r.semester, [r]);
  }

  const semesters: SemesterResult[] = [];
  for (const [semester, courses] of bySem) {
    const graded = courses.filter(
      (c) => c.gradePoints !== null && c.credits > 0
    );
    const creditSum = graded.reduce((s, c) => s + c.credits, 0);
    const weighted = graded.reduce(
      (s, c) => s + c.credits * (c.gradePoints ?? 0),
      0
    );
    semesters.push({
      semester,
      courses,
      sgpa: creditSum > 0 ? r2(weighted / creditSum) : null,
      creditsRegistered: courses.reduce((s, c) => s + c.credits, 0),
      creditsEarned: courses.reduce((s, c) => s + (c.passed ? c.credits : 0), 0),
    });
  }
  return semesters.sort((a, b) => a.semester.localeCompare(b.semester));
}

/** CGPA = credit-weighted grade points across every graded course. */
export function computeCgpa(results: CourseResult[]): number | null {
  const graded = results.filter((c) => c.gradePoints !== null && c.credits > 0);
  const creditSum = graded.reduce((s, c) => s + c.credits, 0);
  if (creditSum === 0) return null;
  const weighted = graded.reduce(
    (s, c) => s + c.credits * (c.gradePoints ?? 0),
    0
  );
  return r2(weighted / creditSum);
}

/** Assessment column order: known names first, unknown appended sorted. */
export function orderedAssessmentNames(results: CourseResult[]): string[] {
  const seen = new Set<string>();
  for (const r of results) for (const name of r.assessments.keys()) seen.add(name);
  const known = ASSESSMENT_ORDER.filter((n) => seen.has(n));
  const unknown = [...seen]
    .filter((n) => !(ASSESSMENT_ORDER as readonly string[]).includes(n))
    .sort();
  return [...known, ...unknown];
}
