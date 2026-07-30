// ════════════════════════════════════════════════════════════════════
// Supabase Edge Function · face-represent
//
// Computes a DeepFace embedding for a face image (enrolment). Called from the
// browser via supabase.functions.invoke("face-represent", { body: { image } }).
// Holds FACE_SERVICE_URL / FACE_SERVICE_TOKEN so the shared secret never
// reaches the client — the reason this is a proxy after the Vite migration.
//
// Deploy: supabase functions deploy face-represent
// Secrets: FACE_SERVICE_URL, FACE_SERVICE_TOKEN (see _shared/face-service.ts)
// ════════════════════════════════════════════════════════════════════

import { corsHeaders } from "../_shared/cors.ts";
import {
  getCallerId,
  postToService,
  readFaceServiceConfig,
} from "../_shared/face-service.ts";

interface RepresentData {
  embedding: number[];
  dims?: number;
  model?: string;
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
  try {
    const body = await req.json();
    image = typeof body?.image === "string" ? body.image : null;
  } catch {
    image = null;
  }
  if (!image) return json({ error: "Missing image." }, 400);

  const result = await postToService<RepresentData>("/represent", { image }, config);
  if (!result.ok) return json({ error: result.reason }, result.status);
  if (!Array.isArray(result.data?.embedding) || result.data.embedding.length === 0) {
    return json({ error: "Face service returned an unexpected response." }, 502);
  }
  return json({ embedding: result.data.embedding, dims: result.data.dims, model: result.data.model });
});
