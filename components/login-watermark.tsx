"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Animated brand watermark for the login page — a slowly rotating PES
 * compass, a drifting oversized wordmark, and floating orbs. Purely
 * decorative (aria-hidden, pointer-events-none) and applied only to the
 * background layer, never to text or controls. All motion is skipped
 * for prefers-reduced-motion users.
 */
export function LoginWatermark({
  variant = "strong",
}: {
  variant?: "strong" | "faint";
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Gentle entrance for the whole layer.
      gsap.from(scope.current, { opacity: 0, duration: 1.4, ease: "power2.out" });

      // Compass ring: one slow, endless rotation (decorative layer only).
      gsap.to(".wm-ring", {
        rotation: 360,
        transformOrigin: "50% 50%",
        duration: 110,
        ease: "none",
        repeat: -1,
      });
      // Needle counter-rotates even slower for depth.
      gsap.to(".wm-needle", {
        rotation: -360,
        transformOrigin: "50% 50%",
        duration: 170,
        ease: "none",
        repeat: -1,
      });

      // Oversized wordmark drifts vertically, breathing.
      gsap.to(".wm-text", {
        yPercent: -5,
        duration: 12,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });

      // Floating orbs — small random drifts, staggered starts.
      gsap.utils.toArray<HTMLElement>(".wm-orb").forEach((orb, i) => {
        gsap.to(orb, {
          y: gsap.utils.random(-28, 28),
          x: gsap.utils.random(-18, 18),
          duration: gsap.utils.random(7, 11),
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: i * 0.5,
        });
      });
    },
    { scope }
  );

  const strong = variant === "strong";

  return (
    <div
      ref={scope}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Rotating compass rings */}
      <svg
        className={`wm-ring absolute -right-16 -top-20 size-[24rem] ${strong ? "opacity-[0.12]" : "opacity-[0.05]"}`}
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="88" stroke="#E8792B" strokeWidth="3" />
        <circle
          cx="100" cy="100" r="70"
          stroke="#E8792B" strokeWidth="1.5" strokeDasharray="4 10"
        />
        {/* Compass tick marks */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * 80}
              y1={100 + Math.sin(a) * 80}
              x2={100 + Math.cos(a) * 88}
              y2={100 + Math.sin(a) * 88}
              stroke="#E8792B"
              strokeWidth="2.5"
            />
          );
        })}
      </svg>

      {/* Counter-rotating needle */}
      <svg
        className={`wm-needle absolute -right-16 -top-20 size-[24rem] ${strong ? "opacity-[0.15]" : "opacity-[0.06]"}`}
        viewBox="0 0 200 200"
        fill="none"
      >
        <path d="M100 40 L114 100 L100 160 L86 100 Z" fill="currentColor" className="text-white" />
      </svg>

      {/* Second, slower ring bottom-left */}
      <svg
        className={`wm-ring absolute -bottom-40 -left-40 size-[30rem] ${strong ? "opacity-[0.08]" : "opacity-[0.04]"}`}
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1.5" className="text-white" strokeDasharray="2 8" />
        <circle cx="100" cy="100" r="60" stroke="#E8792B" strokeWidth="1" />
      </svg>

      {/* Oversized drifting wordmark */}
      <p
        className={`wm-text absolute -right-4 bottom-36 select-none font-display text-[8rem] font-bold leading-none tracking-tighter ${strong ? "text-white/[0.05]" : "text-foreground/[0.03]"}`}
      >
        PES
      </p>

      {/* Floating orbs */}
      <span className={`wm-orb absolute left-[18%] top-[22%] size-2.5 rounded-full ${strong ? "bg-[#E8792B]/40" : "bg-[#E8792B]/15"}`} />
      <span className={`wm-orb absolute left-[68%] top-[58%] size-1.5 rounded-full ${strong ? "bg-white/30" : "bg-foreground/10"}`} />
      <span className={`wm-orb absolute left-[34%] top-[74%] size-2 rounded-full ${strong ? "bg-[#E8792B]/30" : "bg-[#E8792B]/10"}`} />
      <span className={`wm-orb absolute left-[82%] top-[30%] size-2 rounded-full ${strong ? "bg-white/25" : "bg-foreground/10"}`} />
      <span className={`wm-orb absolute left-[10%] top-[48%] size-1.5 rounded-full ${strong ? "bg-white/20" : "bg-foreground/[0.08]"}`} />
    </div>
  );
}
