import { NextResponse } from "next/server";
import {
  faceServiceConfigured,
  verifyFace,
  isValidServerEmbedding,
} from "@/lib/face-service";

/**
 * Phase-2 seam: server-side face verification via the DeepFace service.
 *
 * Returns 501 until FACE_SERVICE_URL is set, so a caller can feature-detect.
 * When configured it forwards {image, referenceEmbedding} to the service and
 * relays the decision. The service URL and token never reach the client — only
 * a normalized {verified, distance, threshold} (or an error reason) does.
 *
 * Note: the authoritative attendance path calls lib/face-service directly from
 * the server action (see app/student/mark-attendance/actions.ts). This route
 * remains as the documented, feature-detectable HTTP seam.
 */
export async function POST(request: Request) {
  if (!faceServiceConfigured()) {
    return NextResponse.json(
      {
        verified: null,
        reason:
          "Server-side face verification not configured (Phase 2). Set FACE_SERVICE_URL to enable.",
      },
      { status: 501 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ verified: null, reason: "Invalid JSON body." }, { status: 400 });
  }

  const image = (body as { image?: unknown })?.image;
  const referenceEmbedding = (body as { referenceEmbedding?: unknown })?.referenceEmbedding;

  if (typeof image !== "string" || !image) {
    return NextResponse.json(
      { verified: null, reason: "An `image` (data URL or base64) is required." },
      { status: 400 }
    );
  }
  if (!isValidServerEmbedding(referenceEmbedding)) {
    return NextResponse.json(
      { verified: null, reason: "A valid `referenceEmbedding` is required." },
      { status: 400 }
    );
  }

  const result = await verifyFace({ image, referenceEmbedding });
  if (!result.ok) {
    return NextResponse.json({ verified: null, reason: result.reason }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 200 });
}
