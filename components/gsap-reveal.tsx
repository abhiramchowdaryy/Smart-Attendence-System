"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Staggers direct children in on mount. Keep to ≤8 children per group —
 * beyond that the tail of the stagger feels laggy.
 */
export function GsapReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!scope.current) return;
      gsap.from(scope.current.children, {
        opacity: 0,
        y: 24,
        duration: 0.5,
        stagger: 0.08,
        delay,
        ease: "power2.out",
        clearProps: "transform", // keep hover transforms working afterwards
      });
    },
    { scope }
  );

  return (
    <div ref={scope} className={className}>
      {children}
    </div>
  );
}
