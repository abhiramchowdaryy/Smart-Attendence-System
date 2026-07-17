import Link from "next/link";
import { Compass, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/login/actions";
import type { Role } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard" },
    { href: "/student/attendance", label: "My Attendance" },
    { href: "/student/mark-attendance", label: "Mark Attendance" },
    { href: "/student/enroll-face", label: "Enrol Face" },
  ],
  faculty: [
    { href: "/faculty/dashboard", label: "Dashboard" },
    { href: "/faculty/attendance", label: "Attendance" },
    { href: "/faculty/marks", label: "Marks" },
    { href: "/faculty/performance", label: "Performance" },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/attendance", label: "Attendance" },
    { href: "/faculty/attendance", label: "By course" },
    { href: "/faculty/marks", label: "Marks" },
    { href: "/faculty/performance", label: "Performance" },
    { href: "/admin/settings", label: "GPS" },
  ],
};

/**
 * Shared authenticated shell: PES-branded top bar, role-scoped nav,
 * theme toggle, sign out. Server component — sign out is a server action.
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

          <nav aria-label="Main" className="flex flex-1 items-center gap-1">
            {NAV[role].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <span className="hidden text-sm text-muted-foreground md:inline">
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
      <main className="container flex-1 py-6">{children}</main>
    </div>
  );
}
