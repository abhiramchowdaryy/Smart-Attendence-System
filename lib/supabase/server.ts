import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Drop persistence hints so a cookie lives only for the browser session. */
export function toSessionCookie(options: CookieOptions): CookieOptions {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { maxAge, expires, ...rest } = options;
  return rest;
}

/**
 * Server-side Supabase client.
 *
 * `sessionOnly` powers the login "Remember me" checkbox: when the user
 * opts out, the auth cookies are written without maxAge/expires so they
 * are cleared when the browser closes (the middleware honours the same
 * `sa-remember=0` flag on refresh so persistence never creeps back).
 */
export async function createClient({ sessionOnly = false } = {}) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(
                name,
                value,
                sessionOnly ? toSessionCookie(options) : options
              )
            );
          } catch {
            // Called from a Server Component — safe to ignore, the
            // middleware handles session refresh.
          }
        },
      },
    }
  );
}
