import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/utils";
import { toSessionCookie } from "@/lib/supabase/server";

const PROTECTED_PREFIXES = ["/student", "/faculty", "/admin"];

/**
 * Refreshes the session cookie and gates the role route groups behind
 * authentication. Per-role checks live in each section's server layout,
 * with Postgres RLS as the final enforcement regardless.
 */
export async function updateSession(request: NextRequest) {
  // Without credentials the app still boots — login page explains setup.
  if (!supabaseConfigured()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  // "Remember me" opt-out: keep refreshed auth cookies session-scoped too,
  // so token refresh in the middleware doesn't quietly make them persistent.
  const sessionOnly = request.cookies.get("sa-remember")?.value === "0";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(
              name,
              value,
              sessionOnly ? toSessionCookie(options) : options
            )
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() (validates JWT with the auth server) — not getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (needsAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
