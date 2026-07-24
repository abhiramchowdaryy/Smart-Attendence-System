// ════════════════════════════════════════════════════════════════════
// Parent-SMS helpers — pure phone normalisation + message templating.
//
// Shared by the app (to preview / validate before invoking the edge
// function) and mirrored by the Deno edge function that actually sends via
// Twilio (supabase/functions/notify-shortfall). Kept framework-free and
// unit-tested. The wording here is the CANONICAL shortfall message; the DLT
// template registered with the Indian telecom operator must match it (see
// the edge function README).
// ════════════════════════════════════════════════════════════════════

/** The 75% rule — mirror of ELIGIBILITY_THRESHOLD, duplicated so this file
 *  stays dependency-free for the edge-function mirror. */
export const SHORTFALL_THRESHOLD = 75;

/**
 * Normalise an Indian mobile number to E.164 (+91XXXXXXXXXX), or return null
 * when it isn't a valid 10-digit Indian mobile. Accepts spaces, dashes, a
 * leading 0, or an existing +91 / 91 country code.
 */
export function normalizeIndianPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  digits = digits.replace(/\D/g, "");
  // Indian mobile numbers are 10 digits starting 6–9.
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export interface ShortfallMessageInput {
  studentName: string;
  courseName: string;
  /** Official attendance %, e.g. 61.5. */
  officialPct: number;
  threshold?: number;
}

/**
 * The attendance-shortfall SMS body. Must correspond to the DLT-registered
 * template. Kept short (single segment where possible).
 */
export function buildShortfallMessage({
  studentName,
  courseName,
  officialPct,
  threshold = SHORTFALL_THRESHOLD,
}: ShortfallMessageInput): string {
  const pct = Number.isFinite(officialPct) ? Math.round(officialPct) : 0;
  return (
    `Dear Parent, your ward ${studentName} has ${pct}% attendance in ` +
    `${courseName}, below the ${threshold}% requirement. Please ensure ` +
    `regular attendance. - PES University`
  );
}
