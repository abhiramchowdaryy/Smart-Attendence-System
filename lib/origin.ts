/**
 * Resolves the absolute site origin (e.g. `https://app.example.edu`) used to
 * build OAuth redirect URLs. In the browser SPA this is simply the current
 * window origin; an explicit VITE_SITE_URL override is honored first for
 * environments where that differs (e.g. a custom canonical host).
 */
export function resolveOrigin(): string {
  const override = (import.meta.env.VITE_SITE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "");
  if (override) return override;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
