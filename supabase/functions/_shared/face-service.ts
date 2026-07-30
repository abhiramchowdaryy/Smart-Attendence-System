// ════════════════════════════════════════════════════════════════════
// Shared client for the DeepFace verification service, used by the
// face-represent and face-verify edge functions.
//
// FACE_SERVICE_URL / FACE_SERVICE_TOKEN are read from the function's secrets
// and NEVER reach the browser — this proxy is exactly why the token stays
// server-side after the Next.js → Vite migration.
//
// Deploy:
//   supabase functions deploy face-represent face-verify
//   supabase secrets set FACE_SERVICE_URL=https://your-deepface-host \
//                        FACE_SERVICE_TOKEN=your-shared-secret
// ════════════════════════════════════════════════════════════════════

export const FACE_SERVICE_TIMEOUT_MS = 20_000;

export interface FaceServiceConfig {
  baseUrl: string;
  token: string | null;
}

export function readFaceServiceConfig(): FaceServiceConfig | null {
  const baseUrl = Deno.env.get("FACE_SERVICE_URL")?.trim();
  if (!baseUrl) return null;
  const token = Deno.env.get("FACE_SERVICE_TOKEN")?.trim() || null;
  return { baseUrl, token };
}

function buildServiceUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function serviceHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Face-Service-Token"] = token;
  return headers;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; reason: string };

export async function postToService<T>(
  path: string,
  payload: unknown,
  config: FaceServiceConfig,
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FACE_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(buildServiceUrl(config.baseUrl, path), {
      method: "POST",
      headers: serviceHeaders(config.token),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, data: body as T };
    }
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : undefined;
    return { ok: false, status: res.status, reason: detail || `Face service error (${res.status}).` };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      reason: aborted
        ? "Face service timed out — please try again."
        : "Could not reach the face service.",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Verify the caller's JWT and return their user id, or null. */
export async function getCallerId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
