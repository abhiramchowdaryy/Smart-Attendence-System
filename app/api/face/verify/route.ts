import { NextResponse } from "next/server";

/**
 * Phase-2 seam: forwards a captured frame to the DeepFace service for
 * identity matching. Returns 501 until FACE_SERVICE_URL is set, so
 * callers can feature-detect.
 */
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

  const body = await request.json();
  const upstream = await fetch(`${serviceUrl}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return NextResponse.json(await upstream.json(), {
    status: upstream.status,
  });
}
