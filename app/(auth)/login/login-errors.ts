import { COLLEGE_EMAIL_DOMAIN } from "@/lib/utils";

/**
 * Stable error codes passed from the OAuth callback to the login page via
 * `?error=<code>`. The callback never reflects raw provider text into the URL
 * — it emits one of these codes, and the login page maps it to a fixed
 * message here. That keeps attacker- or provider-controlled strings out of the
 * rendered page (no reflected-content phishing).
 */
export type LoginErrorCode =
  | "domain"
  | "not_student"
  | "oauth"
  | "config"
  | "cancelled";

const MESSAGES: Record<LoginErrorCode, string> = {
  domain: `Please sign in with your college Google account (@${COLLEGE_EMAIL_DOMAIN}).`,
  not_student:
    "Google sign-in is for students only. Faculty and admin sign in with a password.",
  oauth: "Google sign-in could not be completed. Please try again.",
  config: "Supabase is not configured.",
  cancelled: "Sign-in was cancelled before it completed.",
};

/** Maps an `?error=` code to a fixed message, or null when there is none. */
export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return (
    MESSAGES[code as LoginErrorCode] ??
    "Sign-in could not be completed. Please try again."
  );
}
