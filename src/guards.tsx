import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, roleHome } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/page-skeleton";
import type { Role } from "@/lib/utils";

/**
 * Role gate for a section (replaces the Next middleware + server `requireRole`).
 * Redirects to /login when unauthenticated and to the user's own home when the
 * role doesn't match. Postgres RLS remains the final enforcement layer.
 */
export function RequireRole({ allowed }: { allowed: Role[] }) {
  const { loading, user, profile } = useAuth();
  const location = useLocation();

  if (loading) return <PageSkeleton />;
  if (!user || !profile) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!allowed.includes(profile.role)) {
    return <Navigate to={roleHome(profile.role)} replace />;
  }
  return (
    <AppShell role={profile.role} userName={profile.fullName}>
      <Outlet />
    </AppShell>
  );
}

/**
 * Gate for the read-only /parent section. "Parent" is not a stored role — it is
 * a student account signed in through the parent page (parentView flag),
 * remembered in localStorage. Verifies the flag is set and the account is
 * genuinely a student, then presents the student's own profile as the child.
 */
export function RequireParentView() {
  const { loading, user, profile, parentView } = useAuth();

  if (loading) return <PageSkeleton />;
  if (!parentView || !user || !profile || profile.role !== "student") {
    return <Navigate to="/parent-login" replace />;
  }
  return (
    <AppShell role="parent" userName={profile.fullName}>
      <Outlet />
    </AppShell>
  );
}
