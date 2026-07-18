"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

interface KpiCardProps {
  label: string;
  /** Static display value — used as-is when countTo is not provided. */
  value: string;
  sub?: string;
  /**
   * Rendered icon element, e.g. `icon={<GraduationCap />}`. This is a
   * ReactNode rather than a LucideIcon because most callers are Server
   * Components, and a component reference cannot cross the server/client
   * boundary — only an already-rendered element can. The wrapper sizes it.
   */
  icon: ReactNode;
  tone?: "neutral" | "present" | "late" | "absent";
  /** When set, the number counts up from 0 to this on mount. */
  countTo?: number;
  /** Appended after the animated number (e.g. "%", " min"). */
  suffix?: string;
}

const TONE_CLASS = {
  neutral: "text-primary bg-primary/10",
  present: "text-status-present-strong bg-status-present/10",
  late: "text-status-late-strong bg-status-late/10",
  absent: "text-status-absent-strong bg-status-absent/10",
} as const;

/**
 * KPI stat tile with a GSAP count-up and a hover lift. The final value
 * is always present for reduced-motion users and screen readers.
 */
export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "neutral",
  countTo,
  suffix = "",
}: KpiCardProps) {
  const numberRef = useRef<HTMLParagraphElement>(null);

  useGSAP(() => {
    const el = numberRef.current;
    if (
      el === null ||
      countTo === undefined ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const counter = { v: 0 };
    gsap.to(counter, {
      v: countTo,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = `${Math.round(counter.v)}${suffix}`;
      },
    });
  }, [countTo, suffix]);

  return (
    <Card className="group transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-pop">
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110 [&_svg]:size-5",
            TONE_CLASS[tone]
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {/* aria-label carries the final value while GSAP animates textContent */}
          <p
            ref={numberRef}
            aria-label={value}
            className="font-display text-2xl font-semibold leading-tight"
          >
            {value}
          </p>
          {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
