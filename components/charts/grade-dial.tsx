"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Award, TrendingUp, AlertTriangle, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const SIZE = 168;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * GPA meter on the 10-point scale (SGPA/CGPA hero number). Same motion
 * language as AttendanceRing: the arc draws in with GSAP while the value
 * counts up; state is always icon + label, never color alone; the final
 * value renders statically under prefers-reduced-motion.
 */
export function GradeDial({
  value,
  label,
  sub,
}: {
  /** GPA 0..10, or null for "no data". */
  value: number | null;
  /** e.g. "SGPA — Sem-4" */
  label: string;
  sub?: string;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  const state =
    value === null
      ? ({ tone: "muted", caption: "No results yet", Icon: CircleDashed } as const)
      : value >= 8.5
        ? ({ tone: "present", caption: "Excellent standing", Icon: Award } as const)
        : value >= 6.5
          ? ({ tone: "neutral", caption: "Good standing", Icon: TrendingUp } as const)
          : ({ tone: "late", caption: "Needs attention", Icon: AlertTriangle } as const);

  useGSAP(() => {
    if (value === null) return;
    const arc = arcRef.current;
    const num = numRef.current;
    const target = CIRCUMFERENCE * (1 - value / 10);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (arc) arc.style.strokeDashoffset = String(target);
      return;
    }
    if (arc) {
      gsap.fromTo(
        arc,
        { strokeDashoffset: CIRCUMFERENCE },
        { strokeDashoffset: target, duration: 1.3, ease: "power2.out" }
      );
    }
    if (num) {
      const counter = { v: 0 };
      gsap.to(counter, {
        v: value,
        duration: 1.3,
        ease: "power2.out",
        onUpdate: () => {
          num.textContent = counter.v.toFixed(2);
        },
      });
    }
  }, [value]);

  const RING = {
    muted: "stroke-muted-foreground/40",
    present: "stroke-status-present",
    neutral: "stroke-primary",
    late: "stroke-status-late",
  }[state.tone];

  const TEXT = {
    muted: "text-muted-foreground",
    present: "text-status-present",
    neutral: "text-primary",
    late: "text-status-late",
  }[state.tone];

  return (
    <figure
      className="flex flex-col items-center gap-3"
      role="img"
      aria-label={
        value === null
          ? `${label}: no results recorded yet`
          : `${label}: ${value.toFixed(2)} out of 10. ${state.caption}.`
      }
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none" strokeWidth={STROKE}
            className="stroke-muted"
          />
          {value !== null && (
            <circle
              ref={arcRef}
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE}
              className={cn("transition-colors", RING)}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {value === null ? (
            <span className="font-display text-3xl font-bold text-muted-foreground">—</span>
          ) : (
            <span className="font-display text-4xl font-bold tabular-nums">
              <span ref={numRef}>0.00</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground">{sub ?? "out of 10"}</span>
        </div>
      </div>
      <figcaption className={cn("flex items-center gap-1.5 text-sm font-medium", TEXT)}>
        <state.Icon className="size-4 shrink-0" aria-hidden="true" />
        {state.caption}
      </figcaption>
    </figure>
  );
}
