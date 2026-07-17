// ════════════════════════════════════════════════════════════════════
// Face identity + liveness — pure logic (Phase 2, sub-project 2).
//
// The browser (face-api) produces a 128-d descriptor per face and 68
// landmark points. This module holds only the framework-free math over
// those numbers — distance, match decision, descriptor (de)serialization,
// and the eye-aspect-ratio used for blink liveness — so it unit-tests
// without a camera or any face-api import.
// ════════════════════════════════════════════════════════════════════

/** face-api face descriptors are 128-dimensional. */
export const DESCRIPTOR_LENGTH = 128;

/**
 * Euclidean-distance match threshold. face-api's own FaceMatcher default
 * is 0.6; same-person descriptors typically land ~0.3–0.5 apart and
 * different people ~0.7+. Lower = stricter. Single source of truth.
 */
export const FACE_MATCH_THRESHOLD = 0.6;

/** A serialized descriptor, safe to store as JSON in profiles.face_embedding. */
export type FaceDescriptor = number[];

/** Euclidean (L2) distance between two equal-length descriptors. */
export function euclideanDistance(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (a.length !== b.length) {
    throw new Error(
      `descriptor length mismatch: ${a.length} vs ${b.length}`
    );
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** True when the two faces are close enough to be the same person. */
export function isFaceMatch(
  distance: number,
  threshold: number = FACE_MATCH_THRESHOLD
): boolean {
  return distance <= threshold;
}

/**
 * Map a distance to a 0..1 "how sure" score for display: 1 at distance 0,
 * fading to 0 at distance 1. Purely cosmetic — the match decision uses the
 * distance/threshold, not this.
 */
export function matchConfidence(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

/** Convert a Float32Array (or array) descriptor to a plain number[]. */
export function serializeDescriptor(d: ArrayLike<number>): FaceDescriptor {
  return Array.from(d, (x) => Number(x));
}

/** Guard: is this stored value a usable 128-d descriptor? */
export function isValidDescriptor(value: unknown): value is FaceDescriptor {
  return (
    Array.isArray(value) &&
    value.length === DESCRIPTOR_LENGTH &&
    value.every((x) => typeof x === "number" && Number.isFinite(x))
  );
}

// ── Liveness: eye-aspect-ratio (EAR) blink detection ─────────────────
// EAR drops sharply when an eye closes, so a closed→open transition is a
// cheap liveness signal a static photo cannot produce.

export interface Point {
  x: number;
  y: number;
}

/** Below this EAR an eye is considered closed. */
export const BLINK_EAR_THRESHOLD = 0.22;

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Eye aspect ratio from the six face-api eye landmarks, ordered
 * [outer, topOuter, topInner, inner, bottomInner, bottomOuter].
 * EAR = (‖p1-p5‖ + ‖p2-p4‖) / (2·‖p0-p3‖).
 */
export function eyeAspectRatio(eye: Point[]): number {
  if (eye.length !== 6) {
    throw new Error(`expected 6 eye points, got ${eye.length}`);
  }
  const horizontal = dist(eye[0], eye[3]);
  if (horizontal === 0) return 0;
  const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  return vertical / (2 * horizontal);
}

/** Mean EAR across both eyes. */
export function blinkRatio(left: Point[], right: Point[]): number {
  return (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
}
