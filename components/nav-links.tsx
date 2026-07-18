"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenCheck,
  LayoutDashboard,
  ScanFace,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { href: "/student/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/student/mark-attendance", label: "Mark Attendance", Icon: ScanFace },
  ],
  faculty: [
    { href: "/faculty/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/faculty/marks", label: "Marks", Icon: BookOpenCheck },
    { href: "/faculty/performance", label: "Performance", Icon: TrendingUp },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/faculty/marks", label: "Marks", Icon: BookOpenCheck },
    { href: "/faculty/performance", label: "Performance", Icon: TrendingUp },
  ],
};

/** Top-bar links (desktop). Active page gets aria-current + emphasis. */
export function TopNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="hidden flex-1 items-center gap-1 md:flex"
    >
      {NAV[role].map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Bottom tab bar (mobile). Faculty mark attendance on phones between
 * classes — primary destinations live in the thumb zone with ≥44px
 * targets instead of a cramped top bar.
 */
export function BottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV[role];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.Icon
                className={cn("size-5", active && "stroke-[2.25]")}
                aria-hidden="true"
              />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
