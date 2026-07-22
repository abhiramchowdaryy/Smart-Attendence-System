// Unit tests for lib/face-service.ts — run: node --test lib/face-service.test.ts
//
// The fetch is injected, so these exercise the full request/response path —
// including timeout and network-failure handling — without a running service.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildServiceUrl,
  serviceHeaders,
  interpretResponse,
  faceServiceConfigured,
  readFaceServiceConfig,
  isValidServerEmbedding,
  representFace,
  verifyFace,
  type FaceServiceConfig,
  type Fetcher,
} from "./face-service.ts";

const CONFIG: FaceServiceConfig = {
  baseUrl: "https://face.example.com",
  token: "s3cret",
  timeoutMs: 1000,
};

/** A fake fetch that returns a fixed status + JSON body and records the call. */
function fakeFetch(
  status: number,
  body: unknown
): { fetchImpl: Fetcher; calls: { url: string; init: RequestInit }[] } {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      status,
      json: async () => body,
    } as unknown as Response;
  }) as Fetcher;
  return { fetchImpl, calls };
}

test("buildServiceUrl: joins with exactly one slash", () => {
  assert.equal(buildServiceUrl("https://x.com", "/verify"), "https://x.com/verify");
  assert.equal(buildServiceUrl("https://x.com/", "/verify"), "https://x.com/verify");
  assert.equal(buildServiceUrl("https://x.com///", "verify"), "https://x.com/verify");
});

test("serviceHeaders: token only when present", () => {
  assert.deepEqual(serviceHeaders("t"), {
    "Content-Type": "application/json",
    "X-Face-Service-Token": "t",
  });
  assert.deepEqual(serviceHeaders(null), { "Content-Type": "application/json" });
});

test("faceServiceConfigured: reflects FACE_SERVICE_URL", () => {
  assert.equal(faceServiceConfigured({}), false);
  assert.equal(faceServiceConfigured({ FACE_SERVICE_URL: "  " }), false);
  assert.equal(
    faceServiceConfigured({ FACE_SERVICE_URL: "https://x" }),
    true
  );
});

test("readFaceServiceConfig: parses url + optional token", () => {
  assert.equal(readFaceServiceConfig({}), null);
  const c = readFaceServiceConfig({
    FACE_SERVICE_URL: " https://x ",
    FACE_SERVICE_TOKEN: " tok ",
  });
  assert.deepEqual(c, { baseUrl: "https://x", token: "tok", timeoutMs: 20_000 });
  const noToken = readFaceServiceConfig({
    FACE_SERVICE_URL: "https://x",
  });
  assert.equal(noToken?.token, null);
});

test("interpretResponse: 2xx with valid body → ok", () => {
  const r = interpretResponse(200, { v: 1 }, (b): b is { v: number } => true);
  assert.deepEqual(r, { ok: true, data: { v: 1 } });
});

test("interpretResponse: 2xx with invalid body → 502", () => {
  const r = interpretResponse(200, { bad: true }, (b): b is never => false);
  assert.equal(r.ok, false);
  assert.equal((r as { status: number }).status, 502);
});

test("interpretResponse: error status surfaces service detail", () => {
  const r = interpretResponse(422, { detail: "no face detected" }, (b): b is never => false);
  assert.deepEqual(r, { ok: false, status: 422, reason: "no face detected" });
});

test("interpretResponse: error status without detail gets a generic reason", () => {
  const r = interpretResponse(500, null, (b): b is never => false);
  assert.equal(r.ok, false);
  assert.match((r as { reason: string }).reason, /500/);
});

test("isValidServerEmbedding: non-empty finite-number arrays only", () => {
  assert.equal(isValidServerEmbedding([0.1, 0.2]), true);
  assert.equal(isValidServerEmbedding([]), false);
  assert.equal(isValidServerEmbedding("nope"), false);
  assert.equal(isValidServerEmbedding([1, NaN]), false);
  assert.equal(isValidServerEmbedding(null), false);
});

test("representFace: sends image, token header, and parses embedding", async () => {
  const { fetchImpl, calls } = fakeFetch(200, {
    embedding: [0.1, 0.2, 0.3],
    dims: 3,
    model: "Facenet512",
  });
  const res = await representFace("data:image/jpeg;base64,AAAA", {
    config: CONFIG,
    fetchImpl,
  });
  assert.equal(res.ok, true);
  assert.deepEqual((res as { data: { embedding: number[] } }).data.embedding, [0.1, 0.2, 0.3]);
  assert.equal(calls[0].url, "https://face.example.com/represent");
  assert.equal(
    (calls[0].init.headers as Record<string, string>)["X-Face-Service-Token"],
    "s3cret"
  );
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    image: "data:image/jpeg;base64,AAAA",
  });
});

test("representFace: unconfigured → 501 result, no throw", async () => {
  const res = await representFace("x", { config: null });
  assert.equal(res.ok, false);
  assert.equal((res as { status: number }).status, 501);
});

test("verifyFace: posts reference_embedding and returns decision", async () => {
  const { fetchImpl, calls } = fakeFetch(200, {
    verified: true,
    distance: 0.12,
    threshold: 0.3,
    model: "Facenet512",
    metric: "cosine",
  });
  const res = await verifyFace(
    { image: "data:image/jpeg;base64,AAAA", referenceEmbedding: [0.1, 0.2] },
    { config: CONFIG, fetchImpl }
  );
  assert.equal(res.ok, true);
  assert.equal((res as { data: { verified: boolean } }).data.verified, true);
  assert.deepEqual(JSON.parse(calls[0].init.body as string), {
    image: "data:image/jpeg;base64,AAAA",
    reference_embedding: [0.1, 0.2],
  });
});

test("verifyFace: service 422 (no face) is surfaced, not thrown", async () => {
  const { fetchImpl } = fakeFetch(422, { detail: "no face detected in the image" });
  const res = await verifyFace(
    { image: "x", referenceEmbedding: [0.1] },
    { config: CONFIG, fetchImpl }
  );
  assert.equal(res.ok, false);
  assert.equal((res as { status: number }).status, 422);
  assert.match((res as { reason: string }).reason, /no face/);
});

test("verifyFace: network failure → 502 result", async () => {
  const fetchImpl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as Fetcher;
  const res = await verifyFace(
    { image: "x", referenceEmbedding: [0.1] },
    { config: CONFIG, fetchImpl }
  );
  assert.equal(res.ok, false);
  assert.equal((res as { status: number }).status, 502);
});

test("verifyFace: abort/timeout → 504 result", async () => {
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    // Simulate the AbortController firing.
    const err = new Error("aborted");
    err.name = "AbortError";
    void init;
    throw err;
  }) as Fetcher;
  const res = await verifyFace(
    { image: "x", referenceEmbedding: [0.1] },
    { config: CONFIG, fetchImpl }
  );
  assert.equal(res.ok, false);
  assert.equal((res as { status: number }).status, 504);
});
