"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Role-scoped primary navigation.
 *
 * Client component only so it can read the pathname and mark the active
 * route — everything else about the shell stays a Server Component.
 *
 * Layout note: the student role has six destinations, which overflows a
 * 375 px header. Rather than hiding them behind a hamburger (an extra tap
 * on the app's most-used controls), the strip scrolls horizontally and the
 * scrollbar is hidden — the standard mobile pattern for a small, flat nav.
 * `overflow-x-auto` on a `min-w-0` flex child is what actually lets it
 * shrink instead of pushing the sign-out button off the edge.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

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
            href={item.href}
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
