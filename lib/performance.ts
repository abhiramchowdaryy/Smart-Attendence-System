// ════════════════════════════════════════════════════════════════════
// Attendance × academic-performance analysis — pure logic.
//
// The PDF calls this "the important thing and main thing in our project":
// don't just show attendance, analyse the *relationship* between showing
// up and scoring well, then give the student personalised, plain-language
// feedback plus a light prediction.
//
// Everything here is framework-free and deterministic (no React, no I/O,
// no randomness) so it unit-tests without a browser or a database. The
// grade bands are reused from lib/results so "expected grade" and the
// results page can never disagree; the 75 % line is reused from
// lib/attendance so this module and the eligibility engine share one
// threshold.
// ════════════════════════════════════════════════════════════════════

import { ELIGIBILITY_THRESHOLD, type AttendanceSummaryRow } from "./attendance.ts";
import { gradeForPct, type CourseResult, type LetterGrade } from "./results.ts";

/** Attendance at/above this official % is "healthy" (the eligibility line). */
export const ATTENDANCE_GOOD = ELIGIBILITY_THRESHOLD; // 75

/** Marks at/above this % are treated as satisfactory; below needs work. */
export const MARKS_SATISFACTORY = 60;

/** Which quadrant of the attendance × marks matrix a student sits in. */
export type PerfCategory =
  | "excellent" // high attendance + good marks
  | "marks-focus" // good attendance, weak marks
  | "attendance-focus" // weak attendance, good marks
  | "at-risk" // weak attendance + weak marks
  | "no-data"; // nothing to analyse yet

export type RiskLevel = "Low" | "Moderate" | "High";
export type Likelihood = "High" | "Moderate" | "Low";

/** One subject with its attendance and marks side by side (chart + table). */
export interface SubjectPerformance {
  code: string;
  name: string;
  /** Official attendance % (null when no session conducted yet). */
  attendancePct: number | null;
  /** Weighted-total marks % (null when no marks recorded yet). */
  marksPct: number | null;
}

export interface PerfAnalysis {
  category: PerfCategory;
  /** Short, badge-friendly verdict. */
  headline: string;
  /** Full personalised paragraph, mirroring the PDF's example wording. */
  suggestion: string;
}

export interface PerfPrediction {
  /** Projected final grade from current marks (null when no marks). */
  expectedGrade: LetterGrade | null;
  riskLevel: RiskLevel;
  improvementProbability: Likelihood;
  /** One concrete next step naming the weakest subject(s). */
  recommendedAction: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Fold per-course attendance rows and per-course marks results into one
 * row per subject. Courses appear if they have attendance data, marks, or
 * both; missing sides stay null so the UI can render "—" honestly.
 */
export function combineSubjects(
  attendance: AttendanceSummaryRow[],
  results: CourseResult[]
): SubjectPerformance[] {
  const byCode = new Map<string, SubjectPerformance>();

  for (const a of attendance) {
    byCode.set(a.course_code, {
      code: a.course_code,
      name: a.course_name,
      attendancePct: a.conducted > 0 ? a.official_pct : null,
      marksPct: null,
    });
  }
  for (const c of results) {
    const existing = byCode.get(c.code);
    if (existing) existing.marksPct = c.totalPct;
    else
      byCode.set(c.code, {
        code: c.code,
        name: c.name,
        attendancePct: null,
        marksPct: c.totalPct,
      });
  }

  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Simple mean of the defined values, or null when there are none. */
function meanOf(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return r1(nums.reduce((s, v) => s + v, 0) / nums.length);
}

/** Overall attendance % (aggregate attended/conducted) and mean marks %. */
export function overallAverages(subjects: SubjectPerformance[]): {
  attendancePct: number | null;
  marksPct: number | null;
} {
  return {
    attendancePct: meanOf(subjects.map((s) => s.attendancePct)),
    marksPct: meanOf(subjects.map((s) => s.marksPct)),
  };
}

/**
 * The heart of the feature: map (attendance %, marks %) to a category and
 * a personalised suggestion. Wording deliberately tracks the four worked
 * examples in the requirements PDF. Either input may be null (no data on
 * that axis yet) and the message degrades gracefully.
 */
export function analyzePerformance(
  attendancePct: number | null,
  marksPct: number | null
): PerfAnalysis {
  if (attendancePct === null && marksPct === null) {
    return {
      category: "no-data",
      headline: "Not enough data yet",
      suggestion:
        "Your personalised analysis appears once attendance sessions are held and your faculty records some marks.",
    };
  }

  const attGood = attendancePct !== null && attendancePct >= ATTENDANCE_GOOD;
  const attKnown = attendancePct !== null;
  const marksGood = marksPct !== null && marksPct >= MARKS_SATISFACTORY;
  const marksKnown = marksPct !== null;

  // Both axes known — the full 2×2 matrix from the PDF.
  if (attKnown && marksKnown) {
    if (attGood && marksGood) {
      return {
        category: "excellent",
        headline: "Excellent — keep it up",
        suggestion:
          "Excellent performance. Your attendance and marks are both strong — maintain your attendance and continue your current study pattern.",
      };
    }
    if (attGood && !marksGood) {
      return {
        category: "marks-focus",
        headline: "Good attendance, marks need work",
        suggestion:
          "Your attendance is good, but your academic performance needs improvement. Focus on understanding concepts, practise previous question papers, and meet your faculty for additional guidance.",
      };
    }
    if (!attGood && marksGood) {
      return {
        category: "attendance-focus",
        headline: "Good marks, attendance at risk",
        suggestion:
          "Although your marks are currently good, low attendance may impact your future performance and eligibility. Try to improve your attendance while maintaining your academic results.",
      };
    }
    return {
      category: "at-risk",
      headline: "Attendance and marks both need attention",
      suggestion:
        "Your attendance is below the recommended level, which may be affecting your academic performance. Attend classes regularly, revise lecture notes daily, and seek help from faculty for subjects where your marks are low.",
    };
  }

  // Only attendance known.
  if (attKnown) {
    return attGood
      ? {
          category: "excellent",
          headline: "Attendance on track",
          suggestion:
            "Your attendance is healthy. Marks aren't recorded yet — keep attending and your full analysis will fill in once assessments are graded.",
        }
      : {
          category: "attendance-focus",
          headline: "Attendance below 75%",
          suggestion:
            "Your attendance is below the recommended 75%. Attend upcoming classes to recover your eligibility before assessments are graded.",
        };
  }

  // Only marks known.
  return marksGood
    ? {
        category: "marks-focus",
        headline: "Marks look good",
        suggestion:
          "Your marks are satisfactory. Attendance isn't available yet — keep it above 75% to stay eligible.",
      }
    : {
        category: "at-risk",
        headline: "Marks need work",
        suggestion:
          "Your academic performance needs improvement. Focus on understanding concepts and practise previous question papers, and keep your attendance above 75%.",
      };
}

/**
 * Trend across the two internal assessments (ISA-1 → ISA-2), averaged over
 * every subject that has both. "up" when ISA-2 is clearly higher, "down"
 * when clearly lower, "flat" within a small band, null when unavailable.
 */
export function assessmentTrend(
  results: CourseResult[]
): "up" | "flat" | "down" | null {
  const deltas: number[] = [];
  for (const c of results) {
    const isa1 = c.assessments.get("ISA-1") ?? c.assessments.get("IA-1");
    const isa2 = c.assessments.get("ISA-2") ?? c.assessments.get("IA-2");
    if (!isa1 || !isa2 || isa1.max === 0 || isa2.max === 0) continue;
    deltas.push((isa2.score / isa2.max) * 100 - (isa1.score / isa1.max) * 100);
  }
  if (deltas.length === 0) return null;
  const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
  if (avg > 2) return "up";
  if (avg < -2) return "down";
  return "flat";
}

/** Risk from the two axes: both weak → High, one weak → Moderate, else Low. */
export function riskLevel(
  attendancePct: number | null,
  marksPct: number | null
): RiskLevel {
  const attLow = attendancePct !== null && attendancePct < ATTENDANCE_GOOD;
  const marksLow = marksPct !== null && marksPct < MARKS_SATISFACTORY;
  if (attLow && marksLow) return "High";
  if (attLow || marksLow) return "Moderate";
  return "Low";
}

/** How likely the student is to improve, from attendance + the ISA trend. */
export function improvementProbability(
  attendancePct: number | null,
  trend: "up" | "flat" | "down" | null
): Likelihood {
  const attGood = attendancePct !== null && attendancePct >= ATTENDANCE_GOOD;
  if (trend === "up") return attGood ? "High" : "Moderate";
  if (trend === "down") return attGood ? "Moderate" : "Low";
  // Flat or unknown trend — attendance carries the signal (they show up,
  // so there's runway to improve).
  return attGood ? "High" : "Moderate";
}

/**
 * A concrete next step naming the weakest subjects — the weakest by
 * attendance (below the line) and the weakest by marks (below satisfactory).
 * Mirrors the PDF's "Improve attendance in DBMS and increase practice in
 * Python." When nothing is below the lines, it says to maintain.
 */
export function recommendedAction(subjects: SubjectPerformance[]): string {
  const weakAtt = subjects
    .filter((s) => s.attendancePct !== null && s.attendancePct < ATTENDANCE_GOOD)
    .sort((a, b) => (a.attendancePct ?? 0) - (b.attendancePct ?? 0))[0];
  const weakMarks = subjects
    .filter((s) => s.marksPct !== null && s.marksPct < MARKS_SATISFACTORY)
    .sort((a, b) => (a.marksPct ?? 0) - (b.marksPct ?? 0))[0];

  const parts: string[] = [];
  if (weakAtt) parts.push(`improve attendance in ${weakAtt.name}`);
  if (weakMarks && weakMarks.code !== weakAtt?.code) {
    parts.push(`increase practice in ${weakMarks.name}`);
  } else if (weakMarks && weakMarks.code === weakAtt?.code) {
    // Same subject is weak on both axes — fold it into one clear ask.
    parts[0] = `prioritise ${weakMarks.name}: attend every class and practise more`;
  }

  if (parts.length === 0) {
    return "Maintain your current attendance and study routine.";
  }
  const sentence = parts.join(" and ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/** Assemble the full prediction card from the pieces above. */
export function predictPerformance(
  subjects: SubjectPerformance[],
  attendancePct: number | null,
  marksPct: number | null,
  trend: "up" | "flat" | "down" | null
): PerfPrediction {
  return {
    expectedGrade: marksPct !== null ? gradeForPct(marksPct).grade : null,
    riskLevel: riskLevel(attendancePct, marksPct),
    improvementProbability: improvementProbability(attendancePct, trend),
    recommendedAction: recommendedAction(subjects),
  };
}
