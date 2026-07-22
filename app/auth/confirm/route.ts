import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing route for links in Supabase auth emails (password recovery,
 * magic link, signup confirmation). It establishes the session server-side
 * — handling both the PKCE `code` flow and the `token_hash` email-template
 * flow — then forwards to `next` (defaults to the reset-password page).
 *
 * On failure it sends the user back to /login with a friendly error rather
 * than leaving them on a blank page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/reset-password";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  const failed = new URL(`${origin}/login`);
  failed.searchParams.set(
    "error",
    "That link is invalid or has expired. Request a new one."
  );
  return NextResponse.redirect(failed);
}
