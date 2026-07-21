// ════════════════════════════════════════════════════════════════════
// Attendance ↔ academic performance analysis — pure logic.
//
// The requirements spec calls this "the important thing and main thing in
// our project": beyond *showing* attendance and marks, the system must
// analyse the relationship between the two and produce (a) personalised
// feedback and (b) a lightweight performance prediction.
//
// This is a framework-free, side-effect-free module (mirrors lib/results
// and lib/attendance) so the rubric lives in one place and is trivially
// unit-tested. Grading reuses `gradeForPct` from lib/results and the 75%
// gate reuses `ELIGIBILITY_THRESHOLD` from lib/attendance — no duplicated
// policy constants.
// ════════════════════════════════════════════════════════════════════

import { gradeForPct, type LetterGrade } from "./results.ts";
import { ELIGIBILITY_THRESHOLD } from "./attendance.ts";

/**
 * Average marks at or above this % count as academically strong. Chosen so
 * the four worked examples in the spec fall into the intended quadrants
 * (58/55 → "low", 87/91 → "good"), and separate from the attendance gate
 * so the two axes stay independently tunable.
 */
export const MARKS_GOOD_THRESHOLD = 70;

/**
 * Prediction blend: the projected final % leans on marks (the direct
 * signal) but is nudged by attendance (the leading indicator of future
 * results). Weights sum to 1; kept here so the projection is transparent.
 */
const MARKS_WEIGHT = 0.8;
const ATTENDANCE_WEIGHT = 0.2;

export type Band = "good" | "low";
export type RiskLevel = "Low" | "Medium" | "High";
export type Likelihood = "Low" | "Medium" | "High";

export interface PerformanceInput {
  /** Overall attendance %, 0..100. null when there is no attendance data. */
  attendancePct: number | null;
  /** Average marks %, 0..100. null when no marks are recorded. */
  marksPct: number | null;
}

export interface PerformanceAnalysis {
  attendancePct: number;
  marksPct: number;
  attendanceBand: Band;
  marksBand: Band;
  /** Short quadrant label for a card heading. */
  headline: string;
  /** Personalised, actionable feedback (the four-case rubric). */
  feedback: string;
  /** True when either axis is low → surfaces in "students requiring intervention". */
  atRisk: boolean;
}

export interface PerformancePrediction {
  /** Marks-led blend of the two axes, 0..100 — what the grade derives from. */
  projectedPct: number;
  expectedGrade: LetterGrade;
  riskLevel: RiskLevel;
  improvementProbability: Likelihood;
  recommendedAction: string;
}

/** Clamp to the valid percentage range so a stray input can't skew a grade. */
function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function attendanceBand(pct: number): Band {
  return pct >= ELIGIBILITY_THRESHOLD ? "good" : "low";
}

function marksBand(pct: number): Band {
  return pct >= MARKS_GOOD_THRESHOLD ? "good" : "low";
}

// The four rubric quadrants, keyed by `${attendance}-${marks}` band. Text
// mirrors the spec's worked examples so the domain intent is preserved.
const RUBRIC: Record<
  string,
  { headline: string; feedback: string; recommendedAction: string }
> = {
  "good-good": {
    headline: "Excellent — keep it up",
    feedback:
      "Excellent performance. Maintain your attendance and continue your current study pattern.",
    recommendedAction:
      "Maintain your attendance and current study routine.",
  },
  "good-low": {
    headline: "Strong attendance · academics need focus",
    feedback:
      "Your attendance is good, but your academic performance needs improvement. Focus on understanding concepts, practise previous question papers, and meet your faculty for additional guidance.",
    recommendedAction:
      "Prioritise concept revision and past-paper practice; consult faculty in your weakest subjects.",
  },
  "low-low": {
    headline: "Attendance and marks both need attention",
    feedback:
      "Your attendance is below the recommended level, which may be affecting your academic performance. Attend classes regularly, revise lecture notes daily, and seek help from faculty for subjects where your marks are low.",
    recommendedAction:
      "Improve attendance first, then revise daily and seek faculty help in weak subjects.",
  },
  "low-good": {
    headline: "Good marks · attendance at risk",
    feedback:
      "Although your marks are currently good, low attendance may impact your future performance and exam eligibility. Try to improve your attendance while maintaining your academic results.",
    recommendedAction:
      "Raise your attendance to stay eligible while keeping your marks up.",
  },
};

/**
 * Personalised feedback from the attendance × marks quadrant. Returns null
 * when either axis has no data — an honest "not enough data" beats a
 * confidently wrong verdict.
 */
export function analyzePerformance(
  input: PerformanceInput
): PerformanceAnalysis | null {
  if (input.attendancePct === null || input.marksPct === null) return null;

  const att = clampPct(input.attendancePct);
  const marks = clampPct(input.marksPct);
  const aBand = attendanceBand(att);
  const mBand = marksBand(marks);
  const rubric = RUBRIC[`${aBand}-${mBand}`];

  return {
    attendancePct: att,
    marksPct: marks,
    attendanceBand: aBand,
    marksBand: mBand,
    headline: rubric.headline,
    feedback: rubric.feedback,
    atRisk: aBand === "low" || mBand === "low",
  };
}

/**
 * Lightweight performance prediction: an expected grade from a marks-led
 * blend, a risk level, and an improvement probability. Deterministic and
 * explainable (no black box) — the projection is a transparent weighting,
 * not an opaque model. Returns null when either axis has no data.
 */
export function predictPerformance(
  input: PerformanceInput
): PerformancePrediction | null {
  if (input.attendancePct === null || input.marksPct === null) return null;

  const att = clampPct(input.attendancePct);
  const marks = clampPct(input.marksPct);
  const projectedPct =
    Math.round((MARKS_WEIGHT * marks + ATTENDANCE_WEIGHT * att) * 100) / 100;
  const { grade } = gradeForPct(projectedPct);

  const aBand = attendanceBand(att);
  const mBand = marksBand(marks);

  // Risk: a failing projection or very low attendance is High regardless of
  // the other axis; both-low is High; both-good with high attendance is Low.
  let riskLevel: RiskLevel;
  if (projectedPct < 40 || att < 60 || (aBand === "low" && mBand === "low")) {
    riskLevel = "High";
  } else if (aBand === "good" && mBand === "good" && att >= 85) {
    riskLevel = "Low";
  } else {
    riskLevel = "Medium";
  }

  // Improvement probability leans on engagement: a student who attends is
  // better placed to lift marks than one who does not.
  let improvementProbability: Likelihood;
  if (aBand === "good") {
    improvementProbability = "High"; // engaged — headroom or already trending well
  } else if (mBand === "good") {
    improvementProbability = "Medium"; // capable, needs to show up
  } else {
    improvementProbability = "Low"; // disengaged on both axes
  }

  return {
    projectedPct,
    expectedGrade: grade,
    riskLevel,
    improvementProbability,
    recommendedAction: RUBRIC[`${aBand}-${mBand}`].recommendedAction,
  };
}
