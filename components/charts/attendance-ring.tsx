"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CheckCircle2, AlertTriangle, XCircle, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const SIZE = 168;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/**
 * Attendance-rate meter (single-value "hero number" form, per dataviz).
 * The ring draws in with GSAP while the % counts up. Status is encoded
 * with color AND icon + label — never color alone. 75% is the common
 * university attendance requirement, hence the thresholds.
 */
export function AttendanceRing({
  pct,
  attended,
  held,
}: {
  pct: number | null;
  attended: number;
  held: number;
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  const state =
    pct === null
      ? ({ tone: "muted", label: "No sessions yet", Icon: CircleDashed } as const)
      : pct >= 75
        ? ({ tone: "present", label: "Meets 75% requirement", Icon: CheckCircle2 } as const)
        : pct >= 50
          ? ({ tone: "late", label: "Below 75% requirement", Icon: AlertTriangle } as const)
          : ({ tone: "absent", label: "Critically low", Icon: XCircle } as const);

  useGSAP(() => {
    if (pct === null) return;
    const arc = arcRef.current;
    const num = numRef.current;
    const target = CIRCUMFERENCE * (1 - pct / 100);

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
        v: pct,
        duration: 1.3,
        ease: "power2.out",
        onUpdate: () => {
          num.textContent = String(Math.round(counter.v));
        },
      });
    }
  }, [pct]);

  const RING_COLOR = {
    muted: "stroke-muted-foreground/40",
    present: "stroke-status-present",
    late: "stroke-status-late",
    absent: "stroke-status-absent",
  }[state.tone];

  const TEXT_COLOR = {
    muted: "text-muted-foreground",
    present: "text-status-present",
    late: "text-status-late",
    absent: "text-status-absent",
  }[state.tone];

  return (
    <figure
      className="flex flex-col items-center gap-3"
      role="img"
      aria-label={
        pct === null
          ? "Attendance rate: no sessions recorded yet"
          : `Attendance rate ${pct} percent — ${attended} of ${held} sessions. ${state.label}.`
      }
    >
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          {/* Recessive track */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-muted"
          />
          {/* Value arc — rounded data end */}
          {pct !== null && (
            <circle
              ref={arcRef}
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE}
              className={cn("transition-colors", RING_COLOR)}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {pct === null ? (
            <span className="font-display text-3xl font-bold text-muted-foreground">—</span>
          ) : (
            <span className="font-display text-4xl font-bold tabular-nums">
              <span ref={numRef}>0</span>
              <span className="text-xl text-muted-foreground">%</span>
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {held > 0 ? `${attended} of ${held} sessions` : "attendance"}
          </span>
        </div>
      </div>

      <figcaption
        className={cn("flex items-center gap-1.5 text-sm font-medium", TEXT_COLOR)}
      >
        <state.Icon className="size-4 shrink-0" aria-hidden="true" />
        {state.label}
      </figcaption>
    </figure>
  );
}
