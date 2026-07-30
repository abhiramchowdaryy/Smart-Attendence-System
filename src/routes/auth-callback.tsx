import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth, isCollegeEmail } from "@/lib/auth";
import { supabaseConfigured, ROLE_HOME, type Role } from "@/lib/utils";
import type { LoginErrorCode } from "@/app/(auth)/login/login-errors";

/**
 * Google OAuth callback (replaces the Next route handler). supabase-js
 * (detectSessionInUrl + PKCE) completes the code exchange automatically; here
 * we enforce the two rules Google's `hd` hint cannot guarantee:
 *   1. The address must be on the college Workspace domain.
 *   2. Google sign-in is for students only.
 * On any failure we sign out and bounce to /login?error=<code> (a stable code,
 * never raw provider text).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [message, setMessage] = useState("Completing sign-in…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const bounce = (code: LoginErrorCode) =>
      navigate(`/login?error=${code}`, { replace: true });

    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (!supabaseConfigured()) return bounce("config");
      if (params.get("error")) return bounce("oauth");

      const supabase = createClient();
      let {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user && params.get("code")) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        if (error || !data.user) return bounce("oauth");
        user = data.user;
      }
      if (!user) return bounce("cancelled");

      if (!isCollegeEmail(user.email)) {
        await supabase.auth.signOut();
        return bounce("domain");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        return bounce("oauth");
      }
      if ((profile.role as Role) !== "student") {
        await supabase.auth.signOut();
        return bounce("not_student");
      }

      setMessage("Signed in — redirecting…");
      await refresh();
      navigate(ROLE_HOME.student, { replace: true });
    })();
  }, [navigate, refresh]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </main>
  );
}
