import Image from "next/image";
import { cn } from "@/lib/utils";

// Intrinsic size of the source artwork (public/pes-university-logo*.png).
const LOGO_W = 400;
const LOGO_H = 183;

/**
 * Official PES University logo lockup (compass emblem + "PES UNIVERSITY").
 *
 * The artwork is navy ink on transparency, which disappears on the app's dark
 * surfaces, so we ship two files and swap them by theme with pure CSS (the app
 * toggles the `dark` class on <html>, so no JS or hydration is involved). Both
 * are tiny PNGs; the hidden one costs a few KB and avoids any theme-flash.
 *
 * Size it by setting a height utility in `className` (e.g. `h-9`); width scales
 * to preserve the aspect ratio.
 */
export function PesLogo({
  className,
  priority = false,
  variant = "auto",
}: {
  /** Height utility drives the size, e.g. "h-8 sm:h-9". */
  className?: string;
  /** Set on above-the-fold marks (login hero) to prioritise the LCP image. */
  priority?: boolean;
  /** Force a single variant when the surface is always light or always dark. */
  variant?: "auto" | "light" | "dark";
}) {
  const alt = "PES University";

  if (variant !== "auto") {
    return (
      <Image
        src={variant === "dark" ? "/pes-university-logo-dark.png" : "/pes-university-logo.png"}
        alt={alt}
        width={LOGO_W}
        height={LOGO_H}
        priority={priority}
        className={cn("w-auto", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex", className)}>
      <Image
        src="/pes-university-logo.png"
        alt={alt}
        width={LOGO_W}
        height={LOGO_H}
        priority={priority}
        className="block h-full w-auto dark:hidden"
      />
      <Image
        src="/pes-university-logo-dark.png"
        alt=""
        aria-hidden="true"
        width={LOGO_W}
        height={LOGO_H}
        priority={priority}
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
