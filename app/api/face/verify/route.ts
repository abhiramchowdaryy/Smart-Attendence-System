import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Phase-2 seam: forwards a captured frame to the DeepFace service for
 * identity matching. Returns 501 until FACE_SERVICE_URL is set, so
 * callers can feature-detect.
 *
 * Hardening notes — this handler proxies to an internal service, so it is
 * an amplification point and is treated as one:
 *  • Authenticated. Previously any anonymous caller could drive the face
 *    service through this route, burning its CPU/quota and reaching an
 *    origin not otherwise exposed to the internet.
 *  • Bounded body. Frame payloads are large; an unbounded one lets a
 *    single request pin memory.
 *  • Bounded upstream wait. Without a timeout a hung DeepFace service
 *    holds this function open until the platform kills it, so one stuck
 *    dependency consumes the whole concurrency budget.
 *  • Guarded parses. Neither the inbound body nor the upstream response
 *    is trusted to be JSON — an HTML error page from the service used to
 *    surface as an unhandled 500.
 */

/** Generous enough for a JPEG frame, small enough to bound memory. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function POST(request: Request) {
  const serviceUrl = process.env.FACE_SERVICE_URL;

  if (!serviceUrl) {
    return NextResponse.json(
      {
        verified: null,
        reason:
          "Server-side face verification not configured (Phase 2). Set FACE_SERVICE_URL to enable.",
      },
      { status: 501 }
    );
  }

  // ── Authn: the proxy is for signed-in users only ────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { verified: null, reason: "Not signed in." },
      { status: 401 }
    );
  }

  // ── Bounded, guarded inbound parse ──────────────────────────────────
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { verified: null, reason: "Payload too large." },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { verified: null, reason: "Payload too large." },
        { status: 413 }
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { verified: null, reason: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { verified: null, reason: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  // ── Bounded upstream call ───────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(`${serviceUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Bind the request to the caller server-side. The client cannot
      // assert whose face it is claiming to verify.
      body: JSON.stringify({ ...body, userId: user.id }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return NextResponse.json(
      {
        verified: null,
        reason: timedOut
          ? "Face service timed out."
          : "Face service is unreachable.",
      },
      { status: 504 }
    );
  }

  const text = await upstream.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  } catch {
    // Upstream returned something that isn't JSON (proxy error page, HTML
    // stack trace). Don't echo it back — it can carry internal detail.
    return NextResponse.json(
      { verified: null, reason: "Face service returned an invalid response." },
      { status: 502 }
    );
  }
}
