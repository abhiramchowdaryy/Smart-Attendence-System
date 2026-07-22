// ════════════════════════════════════════════════════════════════════
// Timetable helpers — pure formatting + grouping (unit-tested).
// ════════════════════════════════════════════════════════════════════

/** 1-indexed so day_of_week (1=Mon … 6=Sat) maps directly. Index 0 unused. */
export const DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "09:00:00" / "09:00" → "9:00 AM"; "13:30" → "1:30 PM". */
export function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = mStr ?? "00";
  if (!Number.isFinite(h)) return t;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

export interface TimetableSlot {
  id: string;
  course_code: string;
  course_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  section: string | null;
}

/**
 * Bucket slots into days 1..6 (each an array sorted by start time). Returns
 * a 6-element array; index i holds day i+1's slots.
 */
export function groupByDay(slots: TimetableSlot[]): TimetableSlot[][] {
  const days: TimetableSlot[][] = [[], [], [], [], [], []];
  for (const s of slots) {
    if (s.day_of_week >= 1 && s.day_of_week <= 6) {
      days[s.day_of_week - 1].push(s);
    }
  }
  for (const day of days) {
    day.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }
  return days;
}
