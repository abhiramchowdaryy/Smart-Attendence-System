// ════════════════════════════════════════════════════════════════════
// Server-side client for the DeepFace verification service (Phase 2+).
//
// This is the Next.js half of the FACE_SERVICE_URL seam. When the service is
// configured, enrolment computes a server-side embedding here and
// mark-attendance re-verifies the live *image* here — so identity is decided
// from raw pixels by a model the browser can't influence, closing the
// "browser produces the descriptor" hole documented in the README.
//
// The network-free helpers (URL building, header assembly, response
// interpretation) are exported and unit-tested; the fetch itself is injectable
// so the whole client tests without a running service.
// ════════════════════════════════════════════════════════════════════

/** Milliseconds before a call to the face service is abandoned. The model can
 *  be slow on a cold free-tier instance, so this is generous. */
export const FACE_SERVICE_TIMEOUT_MS = 20_000;

export type Fetcher = typeof fetch;

/** Just the env shape this module reads — accepts process.env or a test stub. */
export type EnvLike = Record<string, string | undefined>;

export interface FaceServiceConfig {
  baseUrl: string;
  token: string | null;
  timeoutMs: number;
}

/** A server-computed face embedding — variable length depending on the model. */
export type ServerEmbedding = number[];

export interface RepresentData {
  embedding: ServerEmbedding;
  dims: number;
  model: string;
}

export interface VerifyData {
  verified: boolean;
  distance: number;
  threshold: number;
  model: string;
  metric: string;
  dims?: number;
}

/** Discriminated result so callers can fall back instead of catching throws. */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; reason: string };

// ── Configuration (network-free) ─────────────────────────────────────────

/** True when FACE_SERVICE_URL is set — the switch between the browser-descriptor
 *  path and the fully server-side path. */
export function faceServiceConfigured(env: EnvLike = process.env): boolean {
  return Boolean(env.FACE_SERVICE_URL && env.FACE_SERVICE_URL.trim());
}

/** Read the service config from the environment, or null if not configured. */
export function readFaceServiceConfig(
  env: EnvLike = process.env
): FaceServiceConfig | null {
  const baseUrl = env.FACE_SERVICE_URL?.trim();
  if (!baseUrl) return null;
  const token = env.FACE_SERVICE_TOKEN?.trim() || null;
  return { baseUrl, token, timeoutMs: FACE_SERVICE_TIMEOUT_MS };
}

/** Join the base URL and a path with exactly one slash, tolerating a trailing
 *  slash on the base. */
export function buildServiceUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** Request headers, including the shared-secret token when configured. */
export function serviceHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["X-Face-Service-Token"] = token;
  return headers;
}

/**
 * Turn a service HTTP response into a normalized ServiceResult. Kept pure (takes
 * status + parsed body, not a Response) so every branch is unit-testable. The
 * `reason` is a user-safe string — the raw service URL is never included.
 */
export function interpretResponse<T>(
  status: number,
  body: unknown,
  validate: (b: unknown) => b is T
): ServiceResult<T> {
  if (status >= 200 && status < 300) {
    if (validate(body)) return { ok: true, data: body };
    return { ok: false, status: 502, reason: "Face service returned an unexpected response." };
  }
  const detail =
    body && typeof body === "object" && "detail" in body
      ? String((body as { detail: unknown }).detail)
      : undefined;
  return { ok: false, status, reason: detail || `Face service error (${status}).` };
}

function isRepresentData(b: unknown): b is RepresentData {
  return (
    !!b &&
    typeof b === "object" &&
    Array.isArray((b as RepresentData).embedding) &&
    (b as RepresentData).embedding.every((x) => typeof x === "number" && Number.isFinite(x)) &&
    (b as RepresentData).embedding.length > 0
  );
}

function isVerifyData(b: unknown): b is VerifyData {
  return (
    !!b &&
    typeof b === "object" &&
    typeof (b as VerifyData).verified === "boolean" &&
    typeof (b as VerifyData).distance === "number"
  );
}

// ── Network calls ──────────────────────────────────────────────────────────

async function postJson<T>(
  path: string,
  payload: unknown,
  validate: (b: unknown) => b is T,
  config: FaceServiceConfig,
  fetchImpl: Fetcher = fetch
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetchImpl(buildServiceUrl(config.baseUrl, path), {
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
    return interpretResponse(res.status, body, validate);
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

/**
 * Compute a server-side embedding for a face image (enrolment). `image` is a
 * data-URL or base64 string. Returns a normalized result; callers decide
 * whether to fall back to the browser descriptor when the service is down.
 */
export async function representFace(
  image: string,
  opts: { config?: FaceServiceConfig | null; fetchImpl?: Fetcher } = {}
): Promise<ServiceResult<RepresentData>> {
  const config = opts.config ?? readFaceServiceConfig();
  if (!config) {
    return { ok: false, status: 501, reason: "Face service is not configured." };
  }
  return postJson("/represent", { image }, isRepresentData, config, opts.fetchImpl);
}

/**
 * Verify a live face image against a stored server embedding (mark-attendance).
 * The service re-embeds the image and compares — the authoritative check.
 */
export async function verifyFace(
  input: { image: string; referenceEmbedding: ServerEmbedding },
  opts: { config?: FaceServiceConfig | null; fetchImpl?: Fetcher } = {}
): Promise<ServiceResult<VerifyData>> {
  const config = opts.config ?? readFaceServiceConfig();
  if (!config) {
    return { ok: false, status: 501, reason: "Face service is not configured." };
  }
  return postJson(
    "/verify",
    { image: input.image, reference_embedding: input.referenceEmbedding },
    isVerifyData,
    config,
    opts.fetchImpl
  );
}

/** Guard: is this stored value a usable server embedding? */
export function isValidServerEmbedding(value: unknown): value is ServerEmbedding {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}
