"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const CIRCLE_C = 2 * Math.PI * 26;
const CHECK_LEN = 40;

/**
 * A one-shot "checkmark draws itself" success mark: the circle sweeps
 * in, the tick draws, then a small pop. Static (fully drawn) for
 * prefers-reduced-motion users.
 */
export function SuccessCheck() {
  const scope = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set([".sc-circle", ".sc-tick"], { strokeDashoffset: 0 });
        return;
      }
      gsap
        .timeline()
        .to(".sc-circle", {
          strokeDashoffset: 0,
          duration: 0.5,
          ease: "power2.out",
        })
        .to(".sc-tick", {
          strokeDashoffset: 0,
          duration: 0.3,
          ease: "power2.out",
        })
        .fromTo(
          scope.current,
          { scale: 1 },
          { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.inOut" }
        );
    },
    { scope }
  );

  return (
    <svg
      ref={scope}
      viewBox="0 0 64 64"
      className="size-14 shrink-0"
      aria-hidden="true"
    >
      <circle
        className="sc-circle"
        cx="32" cy="32" r="26"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={CIRCLE_C}
        strokeDashoffset={CIRCLE_C}
        stroke="hsl(var(--status-present))"
        transform="rotate(-90 32 32)"
      />
      <path
        className="sc-tick"
        d="M21 33 L29 41 L44 25"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CHECK_LEN}
        strokeDashoffset={CHECK_LEN}
        stroke="hsl(var(--status-present))"
      />
    </svg>
  );
}
