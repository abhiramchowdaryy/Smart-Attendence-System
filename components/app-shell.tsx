import Link from "next/link";
import { Compass, LogOut } from "lucide-react";
import { BottomNav, TopNav } from "@/components/nav-links";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/login/actions";
import type { Role } from "@/lib/utils";

/**
 * Shared authenticated shell: PES-branded top bar, role-scoped nav
 * (top links on desktop, bottom tab bar on mobile), theme toggle,
 * sign out. Server component — sign out is a server action; the nav
 * pieces are client components for active-route state.
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
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Keyboard users jump straight past the chrome */}
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container flex h-14 items-center gap-4">
          <Link
            href={`/${role}/dashboard`}
            className="flex items-center gap-2 font-display text-sm font-bold"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Compass className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">PES Smart Attendance</span>
          </Link>

          <TopNav role={role} />

          <span className="ml-auto hidden text-sm text-muted-foreground md:ml-0 md:inline">
            {userName}
          </span>
          <ThemeToggle />
          <form action={signOut}>
            <Button variant="ghost" size="icon" aria-label="Sign out">
              <LogOut className="size-5" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </header>

      {/* pb clears the mobile tab bar so content never hides behind it */}
      <main id="main-content" className="container flex-1 py-6 pb-24 md:pb-6">
        {children}
      </main>

      <BottomNav role={role} />
    </div>
  );
}
