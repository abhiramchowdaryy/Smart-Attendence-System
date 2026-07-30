// ════════════════════════════════════════════════════════════════════
// Supabase Edge Function · face-verify
//
// Verifies a live face image against a stored server embedding
// (mark-attendance). Called from the browser via
// supabase.functions.invoke("face-verify", { body: { image, referenceEmbedding } }).
// The DeepFace service re-embeds the image and compares — the authoritative
// identity check a forged browser descriptor can't pass. FACE_SERVICE_URL /
// FACE_SERVICE_TOKEN stay in this function's secrets, never in the client.
//
// Deploy: supabase functions deploy face-verify
// Secrets: FACE_SERVICE_URL, FACE_SERVICE_TOKEN (see _shared/face-service.ts)
// ════════════════════════════════════════════════════════════════════

import { corsHeaders } from "../_shared/cors.ts";
import {
  getCallerId,
  postToService,
  readFaceServiceConfig,
} from "../_shared/face-service.ts";

interface VerifyData {
  verified: boolean;
  distance: number;
  threshold?: number;
  model?: string;
  metric?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const userId = await getCallerId(req);
  if (!userId) return json({ error: "Not signed in." }, 401);

  const config = readFaceServiceConfig();
  if (!config) return json({ error: "Face service is not configured." }, 501);

  let image: string | null = null;
  let referenceEmbedding: number[] | null = null;
  try {
    const body = await req.json();
    image = typeof body?.image === "string" ? body.image : null;
    referenceEmbedding = Array.isArray(body?.referenceEmbedding)
      ? body.referenceEmbedding
      : null;
  } catch {
    image = null;
  }
  if (!image) return json({ error: "Missing image." }, 400);
  if (!referenceEmbedding || referenceEmbedding.length === 0) {
    return json({ error: "Missing reference embedding." }, 400);
  }

  const result = await postToService<VerifyData>(
    "/verify",
    { image, reference_embedding: referenceEmbedding },
    config,
  );
  if (!result.ok) return json({ error: result.reason }, result.status);
  if (typeof result.data?.verified !== "boolean") {
    return json({ error: "Face service returned an unexpected response." }, 502);
  }
  return json({
    verified: result.data.verified,
    distance: result.data.distance,
    threshold: result.data.threshold,
    model: result.data.model,
    metric: result.data.metric,
  });
});
