// ════════════════════════════════════════════════════════════════════
// Attendance status labelling from the stored Late-Entry / Early-Exit
// flags — the PDF's five distinct outcomes, derived in one pure place.
// ════════════════════════════════════════════════════════════════════

export type RichStatus =
  | "Present"
  | "Late Entry"
  | "Early Exit"
  | "Partial"
  | "Absent";

/**
 * Map the two boolean flags to the PDF's outcome names:
 *   on time + stayed          → Present
 *   entered late              → Late Entry
 *   left early                → Early Exit
 *   entered late + left early → Partial
 * (Absent has no attendance row, so it isn't produced here.)
 */
export function attendanceLabel(
  lateEntry: boolean,
  earlyExit: boolean
): RichStatus {
  if (lateEntry && earlyExit) return "Partial";
  if (lateEntry) return "Late Entry";
  if (earlyExit) return "Early Exit";
  return "Present";
}
