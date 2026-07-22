// ════════════════════════════════════════════════════════════════════
// Campus-network (college Wi-Fi) verification — pure helpers.
//
// The browser can't read a Wi-Fi SSID, so "on the college network" is
// established server-side by the request's public IP: an admin allow-lists
// the campus egress IP prefix(es), and a request whose IP starts with one
// of them counts as on-network. Prefix matching (not full CIDR) keeps it
// dependency-free and easy for a non-network-engineer admin to configure.
// ════════════════════════════════════════════════════════════════════

/**
 * First hop of an X-Forwarded-For chain (the original client), trimmed.
 * Returns null when the header is absent or empty.
 */
export function clientIp(xForwardedFor: string | null): string | null {
  if (!xForwardedFor) return null;
  const first = xForwardedFor.split(",")[0]?.trim();
  return first ? first : null;
}

/** Normalise an allow-list entry: trim; drop empties. */
export function normalizePrefixes(raw: string[]): string[] {
  return raw.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * True when `ip` starts with any allow-listed prefix. An empty allow-list
 * means the fallback is disabled (never matches).
 */
export function ipMatchesNetwork(
  ip: string | null,
  prefixes: string[]
): boolean {
  if (!ip) return false;
  return normalizePrefixes(prefixes).some((prefix) => ip.startsWith(prefix));
}
