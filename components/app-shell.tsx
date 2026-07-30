"use client";

import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AppNav, type NavItem } from "@/components/app-nav";
import { PesLogo } from "@/components/pes-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/utils";

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/attendance", label: "My Attendance" },
    { href: "/student/results", label: "Results" },
    { href: "/student/mark-attendance", label: "Mark Attendance" },
    { href: "/student/enroll-face", label: "Enrol Face" },
    { href: "/student/profile", label: "Profile" },
  ],
  faculty: [
    { href: "/faculty/dashboard", label: "Dashboard" },
    { href: "/faculty/attendance", label: "Attendance" },
    { href: "/faculty/courses", label: "Courses" },
    { href: "/faculty/marks", label: "Marks" },
    { href: "/faculty/performance", label: "Performance" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/attendance", label: "Attendance" },
    { href: "/faculty/attendance", label: "By course" },
    { href: "/faculty/courses", label: "Courses" },
    { href: "/faculty/marks", label: "Marks" },
    { href: "/admin/settings", label: "GPS" },
  ],
  parent: [{ href: "/parent/dashboard", label: "Dashboard" }],
};

/**
 * Shared authenticated shell: PES-branded top bar, role-scoped nav,
 * theme toggle, sign out. Sign out clears the client session then routes to
 * /login (was a server action in the Next build).
 */
export function AppShell({
  role,
  userName,
  children,
}: {
  role: Role;
  userName: string;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-14 items-center gap-2 sm:gap-4">
          <Link
            to={`/${role}/dashboard`}
            aria-label="PES Smart Attendance — home"
            className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-3"
          >
            <PesLogo className="h-8 sm:h-9" />
            <span
              aria-hidden="true"
              className="hidden h-6 w-px bg-border lg:inline-block"
            />
            <span className="hidden font-display text-sm font-semibold text-muted-foreground lg:inline">
              Smart Attendance
            </span>
          </Link>

          <AppNav items={NAV[role]} />

          <span className="hidden shrink-0 text-sm text-muted-foreground xl:inline">
            {userName}
          </span>
          <span className="flex shrink-0 items-center">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOut className="size-5" aria-hidden="true" />
            </Button>
          </span>
        </div>
      </header>
      <main id="main" className="container flex-1 py-6">
        {children}
      </main>
    </div>
  );
}
