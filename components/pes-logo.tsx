import { cn } from "@/lib/utils";

// Served from /public at the site root (Vite copies public/ verbatim).
const LOGO_LIGHT = "/pes-university-logo.png";
const LOGO_DARK = "/pes-university-logo-dark.png";

/**
 * Official PES University logo lockup (compass emblem + "PES UNIVERSITY").
 *
 * The artwork is navy ink on transparency, which disappears on the app's dark
 * surfaces, so we ship two files and swap them by theme with pure CSS (the app
 * toggles the `dark` class on <html>). Size it with a height utility in
 * `className` (e.g. `h-9`); width scales to preserve the aspect ratio.
 *
 * `priority` is accepted for source-compatibility with call sites but is a
 * no-op now (Vite has no <Image> priority hint).
 */
export function PesLogo({
  className,
  priority: _priority = false,
  variant = "auto",
}: {
  className?: string;
  priority?: boolean;
  variant?: "auto" | "light" | "dark";
}) {
  const alt = "PES University";

  if (variant !== "auto") {
    return (
      <img
        src={variant === "dark" ? LOGO_DARK : LOGO_LIGHT}
        alt={alt}
        className={cn("w-auto", className)}
      />
    );
  }

  return (
    <span className={cn("inline-flex", className)}>
      <img src={LOGO_LIGHT} alt={alt} className="block h-full w-auto dark:hidden" />
      <img
        src={LOGO_DARK}
        alt=""
        aria-hidden="true"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
