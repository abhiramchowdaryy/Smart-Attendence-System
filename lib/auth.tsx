import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  ROLE_HOME,
  supabaseConfigured,
  COLLEGE_EMAIL_DOMAIN,
  isCollegeEmail,
  type Role,
} from "@/lib/utils";

/**
 * localStorage flag marking the current session as being viewed in "parent
 * mode". A parent uses the *student's* own credentials (there is no separate
 * parent account), so the only thing distinguishing a parent from the student
 * is which page they signed in on — this flag remembers that choice and gates
 * the read-only /parent section. (Was an httpOnly cookie in the SSR build.)
 */
const PARENT_VIEW_KEY = "pes-parent-view";

export function getParentView(): boolean {
  try {
    return localStorage.getItem(PARENT_VIEW_KEY) === "1";
  } catch {
    return false;
  }
}
export function setParentView(on: boolean) {
  try {
    if (on) localStorage.setItem(PARENT_VIEW_KEY, "1");
    else localStorage.removeItem(PARENT_VIEW_KEY);
  } catch {
    /* storage unavailable — parent mode simply won't persist */
  }
}

export interface SessionProfile {
  id: string;
  fullName: string;
  rollNo: string | null;
  role: Role;
}

async function fetchProfile(userId: string): Promise<SessionProfile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, roll_no, role")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    rollNo: data.roll_no,
    role: data.role as Role,
  };
}

interface AuthContextValue {
  loading: boolean;
  user: User | null;
  /** DB profile of the signed-in account (null while loading / signed out). */
  profile: SessionProfile | null;
  /** True when the session is being viewed through the parent lens. */
  parentView: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [parentView, setParentViewState] = useState<boolean>(getParentView());

  const applySession = useCallback(async (session: Session | null) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);
    setProfile(nextUser ? await fetchProfile(nextUser.id) : null);
    setParentViewState(getParentView());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => applySession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });
    return () => sub.subscription.unsubscribe();
  }, [applySession]);

  const refresh = useCallback(async () => {
    if (user) setProfile(await fetchProfile(user.id));
    setParentViewState(getParentView());
  }, [user]);

  const signOut = useCallback(async () => {
    if (supabaseConfigured()) await createClient().auth.signOut();
    setParentView(false);
    setParentViewState(false);
  }, []);

  const value = useMemo(
    () => ({ loading, user, profile, parentView, refresh, signOut }),
    [loading, user, profile, parentView, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Landing path for a signed-in user's role. */
export function roleHome(role: Role): string {
  return ROLE_HOME[role];
}

// ── Auth actions (client) ────────────────────────────────────────────
// Replace the "use server" actions from the Next.js build. Each performs the
// Supabase call and returns a plain result; the calling component handles
// navigation (React Router) and refreshing the AuthProvider.

export interface AuthResult {
  error?: string;
}

const NOT_CONFIGURED =
  "Supabase is not configured. Copy .env.example to .env.local and add your project credentials.";

/** Email + password sign-in. Returns the resolved role on success. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthResult & { role?: Role }> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  if (!email || !password) return { error: "Enter both email and password." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: error.message };

  setParentView(false);
  const profile = await fetchProfile(data.user.id);
  return { role: (profile?.role as Role) ?? "student" };
}

/**
 * Parent sign-in. The parent enters their child's *student* email + password
 * and lands on the read-only parent dashboard. Only student accounts qualify.
 */
export async function signInAsParent(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  if (!email || !password)
    return { error: "Enter your child's student email and password." };

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error: error.message };

  const profile = await fetchProfile(data.user.id);
  if (profile?.role !== "student") {
    await supabase.auth.signOut();
    return {
      error:
        "Parent sign-in works only with a student account's email and password.",
    };
  }
  setParentView(true);
  return {};
}

/**
 * Student sign-in with a college Google account. Kicks off the OAuth flow;
 * the browser is redirected to Google, then back to /auth/callback where the
 * college-domain + student-role rules are enforced.
 */
export async function signInWithGoogle(
  redirectOrigin: string
): Promise<AuthResult> {
  if (!supabaseConfigured()) return { error: NOT_CONFIGURED };
  if (!redirectOrigin)
    return { error: "Could not determine the site URL for Google sign-in." };

  setParentView(false);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${redirectOrigin}/auth/callback`,
      queryParams: { hd: COLLEGE_EMAIL_DOMAIN, prompt: "select_account" },
    },
  });
  if (error) return { error: error.message };
  return {};
}

/** Re-export for callback route domain checks. */
export { isCollegeEmail };
