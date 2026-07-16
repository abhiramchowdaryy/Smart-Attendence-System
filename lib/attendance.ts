// ════════════════════════════════════════════════════════════════════
// Attendance policy + rollup logic (Phase 2, sub-project 1).
//
// Single source of truth for the eligibility threshold and status
// weights, plus pure helpers over rows of the `attendance_summary` view.
// No React, no side effects → fast to unit-test. The only Supabase
// reference is a `import type`, which is erased at runtime.
// ════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

/** A student is eligible in a course at or above this official %. */
export const ELIGIBILITY_THRESHOLD = 75;

/** Quality weighting: late/partial are half-credit; absent is zero. */
export const STATUS_WEIGHTS = {
  present: 1,
  late: 0.5,
  partial: 0.5,
  absent: 0,
} as const;

/** One row of the `attendance_summary` view. */
export interface AttendanceSummaryRow {
  student_id: string;
  course_code: string;
  course_name: string;
  credits: number;
  semester: string;
  conducted: number;
  present_cnt: number;
  late_cnt: number;
  partial_cnt: number;
  absent_cnt: number;
  /** null when conducted === 0 ("No data"). */
  official_pct: number | null;
  weighted_pct: number | null;
}

/** Sessions counted as attended (present + late + partial). */
export function attendedCount(r: AttendanceSummaryRow): number {
  return r.present_cnt + r.late_cnt + r.partial_cnt;
}

/**
 * Eligible = official % at or above the threshold. "No data"
 * (conducted 0 → null) is treated as NOT eligible, never as pass.
 */
export function isEligible(officialPct: number | null): boolean {
  if (officialPct === null || Number.isNaN(officialPct)) return false;
  return officialPct >= ELIGIBILITY_THRESHOLD;
}

/** "76.47%" for a number, "No data" for null/NaN. */
export function formatPct(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "No data";
  return `${n.toFixed(2)}%`;
}

export interface StudentSummary {
  /** Courses with at least one conducted session (data present). */
  coursesWithData: number;
  /** Of those, how many are at/above threshold. */
  eligibleCourses: number;
  /** Courses below threshold (data present), lowest official % first. */
  shortfallCourses: AttendanceSummaryRow[];
  /** The single worst course by official %, or null when no data anywhere. */
  worstCourse: AttendanceSummaryRow | null;
  /** True when any course with data is below threshold. */
  anyShortfall: boolean;
  /**
   * Overall official % across all courses (aggregate attended / aggregate
   * conducted). null when no course has any conducted session.
   */
  overallOfficialPct: number | null;
}

/** Roll a student's per-course rows up into one headline summary. */
export function summarizeStudent(rows: AttendanceSummaryRow[]): StudentSummary {
  const withData = rows.filter((r) => r.conducted > 0);

  const shortfallCourses = withData
    .filter((r) => !isEligible(r.official_pct))
    .sort((a, b) => (a.official_pct ?? 0) - (b.official_pct ?? 0));

  const worstCourse =
    withData.length === 0
      ? null
      : withData.reduce((worst, r) =>
          (r.official_pct ?? 0) < (worst.official_pct ?? 0) ? r : worst
        );

  const totalConducted = withData.reduce((s, r) => s + r.conducted, 0);
  const totalAttended = withData.reduce((s, r) => s + attendedCount(r), 0);
  const overallOfficialPct =
    totalConducted === 0
      ? null
      : Math.round((10000 * totalAttended) / totalConducted) / 100;

  return {
    coursesWithData: withData.length,
    eligibleCourses: withData.filter((r) => isEligible(r.official_pct)).length,
    shortfallCourses,
    worstCourse,
    anyShortfall: shortfallCourses.length > 0,
    overallOfficialPct,
  };
}

// ── Data access ──────────────────────────────────────────────────────
// Thin wrappers over the view. Postgres `numeric` can arrive as a string
// depending on the client path, so coerce percentages defensively.

function toNum(v: unknown): number {
  return typeof v === "string" ? Number(v) : (v as number);
}

function normalizeRow(raw: Record<string, unknown>): AttendanceSummaryRow {
  return {
    student_id: String(raw.student_id),
    course_code: String(raw.course_code),
    course_name: String(raw.course_name),
    credits: toNum(raw.credits),
    semester: String(raw.semester),
    conducted: toNum(raw.conducted),
    present_cnt: toNum(raw.present_cnt),
    late_cnt: toNum(raw.late_cnt),
    partial_cnt: toNum(raw.partial_cnt),
    absent_cnt: toNum(raw.absent_cnt),
    official_pct: raw.official_pct == null ? null : toNum(raw.official_pct),
    weighted_pct: raw.weighted_pct == null ? null : toNum(raw.weighted_pct),
  };
}

/** All attendance-summary rows for one student, optionally one semester. */
export async function fetchStudentAttendance(
  supabase: SupabaseClient,
  studentId: string,
  semester?: string
): Promise<AttendanceSummaryRow[]> {
  let query = supabase
    .from("attendance_summary")
    .select("*")
    .eq("student_id", studentId);
  if (semester) query = query.eq("semester", semester);
  const { data, error } = await query.order("course_code");
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}

/** Every student's summary for one course (faculty report). */
export async function fetchCourseAttendance(
  supabase: SupabaseClient,
  courseCode: string
): Promise<AttendanceSummaryRow[]> {
  const { data, error } = await supabase
    .from("attendance_summary")
    .select("*")
    .eq("course_code", courseCode);
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}

/** Every attendance-summary row (admin rollup; RLS lets staff read all). */
export async function fetchAllAttendance(
  supabase: SupabaseClient
): Promise<AttendanceSummaryRow[]> {
  const { data, error } = await supabase.from("attendance_summary").select("*");
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}

export interface CourseRollup {
  course_code: string;
  course_name: string;
  credits: number;
  semester: string;
  enrolled: number;
  /** Students with at least one conducted session. */
  withData: number;
  belowThreshold: number;
  /** Mean official % across students with data, or null. */
  avgOfficialPct: number | null;
}

/** Group summary rows into one rollup per course (admin institution view). */
export function rollupByCourse(rows: AttendanceSummaryRow[]): CourseRollup[] {
  const byCourse = new Map<string, AttendanceSummaryRow[]>();
  for (const r of rows) {
    const list = byCourse.get(r.course_code);
    if (list) list.push(r);
    else byCourse.set(r.course_code, [r]);
  }

  const rollups: CourseRollup[] = [];
  for (const [code, list] of byCourse) {
    const withData = list.filter((r) => r.conducted > 0);
    const avgOfficialPct =
      withData.length > 0
        ? Math.round(
            (withData.reduce((s, r) => s + (r.official_pct ?? 0), 0) /
              withData.length) *
              100
          ) / 100
        : null;
    rollups.push({
      course_code: code,
      course_name: list[0].course_name,
      credits: list[0].credits,
      semester: list[0].semester,
      enrolled: list.length,
      withData: withData.length,
      belowThreshold: withData.filter((r) => !isEligible(r.official_pct)).length,
      avgOfficialPct,
    });
  }
  // Worst average first so at-risk courses surface at the top.
  return rollups.sort(
    (a, b) => (a.avgOfficialPct ?? 200) - (b.avgOfficialPct ?? 200)
  );
}

/** Distinct semesters a student is enrolled in (for the dropdown). */
export async function fetchStudentSemesters(
  supabase: SupabaseClient,
  studentId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("attendance_summary")
    .select("semester")
    .eq("student_id", studentId);
  if (error) throw error;
  const seen = new Set<string>();
  for (const row of data ?? []) seen.add(String((row as { semester: unknown }).semester));
  return [...seen].sort();
}
