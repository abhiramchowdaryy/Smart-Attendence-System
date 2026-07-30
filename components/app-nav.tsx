"use client";

import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Role-scoped primary navigation. Reads the current path to mark the active
 * route. The strip scrolls horizontally on narrow screens (the student role
 * has six destinations) rather than hiding behind a hamburger.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main"
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-muted text-foreground"
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
