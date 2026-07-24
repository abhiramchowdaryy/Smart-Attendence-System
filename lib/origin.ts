/**
 * Resolves the absolute site origin (e.g. `https://app.example.edu`) used to
 * build OAuth redirect URLs. Behind a TLS-terminating proxy the raw request
 * host/scheme is internal (often plain http), so we honor the standard
 * forwarding headers before falling back to an explicit env var and finally
 * the request URL's own origin.
 */
type HeaderReader = { get(name: string): string | null };

export function resolveOrigin(
  headers: HeaderReader,
  fallbackUrl?: string
): string {
  const origin = headers.get("origin");
  if (origin) return origin;

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto = headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (siteUrl) return siteUrl;

  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).origin;
    } catch {
      // Not a valid absolute URL — fall through to the empty string.
    }
  }
  return "";
}
