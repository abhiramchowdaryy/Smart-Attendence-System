// Post-login redirect validation — pure logic, no framework imports, so
// it unit-tests directly. Lives apart from lib/auth.ts (which pulls in
// next/navigation and Supabase) for exactly that reason.

/** Sections a signed-in user may be sent to. */
const ALLOWED_PREFIXES = ["/student/", "/faculty/", "/admin/"] as const;

/**
 * True if the string contains any control character, space, or DEL.
 *
 * Written as an explicit code-point scan rather than a regex with \x
 * escapes: those escapes are easy to mangle when the file is edited, and
 * a silently broken character class here fails open. Ordinary path
 * characters are all above 0x20, so "/student/mark-attendance" passes.
 */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate a post-login redirect target.
 *
 * The middleware records where an unauthenticated user was heading as
 * `?next=`, so this value arrives from the URL bar and is fully
 * attacker-controlled. Only a same-origin absolute path inside a known
 * section is accepted; everything else falls back to the role home.
 *
 * Rejected: absolute URLs, protocol-relative "//host", the "/\" variant
 * browsers normalise to "//", paths outside the app sections, and
 * whitespace/control characters used to confuse downstream parsers.
 */
export function safeRedirectPath(
  candidate: string | null | undefined
): string | null {
  if (!candidate) return null;
  if (hasControlChars(candidate)) return null;

  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//")) return null;
  if (candidate.startsWith("/\\")) return null;

  return ALLOWED_PREFIXES.some((p) => candidate.startsWith(p))
    ? candidate
    : null;
}
