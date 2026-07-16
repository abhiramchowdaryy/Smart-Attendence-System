"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CheckCircle2, MapPin, ScanFace } from "lucide-react";

gsap.registerPlugin(useGSAP);

/**
 * Illustrative product-preview cards for the login hero — a glassy
 * mock of what the app does (entry toast, attendance ring, geofence
 * chip). Decorative marketing imagery: aria-hidden, sample values.
 * Cards stagger in, then levitate gently on offset phases.
 */
export function LoginPreviewCards() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap.from(".preview-card", {
        opacity: 0,
        y: 28,
        duration: 0.6,
        stagger: 0.14,
        delay: 0.25,
        ease: "power2.out",
      });

      // Gentle levitation, each card on its own phase.
      gsap.utils.toArray<HTMLElement>(".preview-card").forEach((card, i) => {
        gsap.to(card, {
          y: i % 2 === 0 ? -8 : 8,
          duration: 4.5 + i,
          yoyo: true,
          repeat: -1,
          delay: 1 + i * 0.6,
          ease: "sine.inOut",
        });
      });
    },
    { scope }
  );

  const glass =
    "preview-card rounded-xl border border-white/15 bg-white/10 shadow-pop backdrop-blur-md";

  return (
    <div
      ref={scope}
      aria-hidden="true"
      className="pointer-events-none relative mx-auto h-64 w-full max-w-sm select-none"
    >
      {/* Entry-recorded toast */}
      <div className={`${glass} absolute left-0 top-2 flex -rotate-2 items-center gap-3 p-3.5`}>
        <span className="flex size-9 items-center justify-center rounded-full bg-[hsl(var(--status-present))]/25">
          <CheckCircle2 className="size-5 text-[hsl(142,71%,55%)]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Entry recorded</p>
          <p className="text-xs text-white/65">Face + location verified · 9:02 AM</p>
        </div>
      </div>

      {/* Mini attendance ring */}
      <div className={`${glass} absolute right-0 top-20 flex rotate-3 items-center gap-3 p-3.5`}>
        <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" className="stroke-white/15" />
          <circle
            cx="22" cy="22" r="18" fill="none" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 18}
            strokeDashoffset={2 * Math.PI * 18 * 0.08}
            stroke="#E8792B"
          />
        </svg>
        <div>
          <p className="font-display text-lg font-bold leading-none text-white">92%</p>
          <p className="text-xs text-white/65">attendance</p>
        </div>
      </div>

      {/* Geofence chip */}
      <div className={`${glass} absolute bottom-2 left-6 flex -rotate-1 items-center gap-2.5 p-3.5`}>
        <span className="relative flex size-4 items-center justify-center">
          <span className="absolute size-4 animate-ping rounded-full bg-[hsl(142,71%,55%)]/50 [animation-duration:2.4s]" />
          <MapPin className="relative size-4 text-[hsl(142,71%,55%)]" />
        </span>
        <p className="text-sm font-medium text-white">
          Inside “Room B-204” <span className="text-white/60">· 18 m</span>
        </p>
      </div>

      {/* Small face-scan chip peeking behind */}
      <div className={`${glass} absolute right-10 top-2 flex rotate-2 items-center gap-2 p-2.5 opacity-80`}>
        <ScanFace className="size-4 text-[#E8792B]" />
        <p className="text-xs font-medium text-white/85">Quality 96%</p>
      </div>
    </div>
  );
}
