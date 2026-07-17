// Unit tests for lib/face.ts — run: node --test lib/face.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESCRIPTOR_LENGTH,
  FACE_MATCH_THRESHOLD,
  BLINK_EAR_THRESHOLD,
  euclideanDistance,
  isFaceMatch,
  matchConfidence,
  serializeDescriptor,
  isValidDescriptor,
  eyeAspectRatio,
  blinkRatio,
  type Point,
} from "./face.ts";

test("euclideanDistance: classic 3-4-5 and zero", () => {
  assert.equal(euclideanDistance([0, 0], [3, 4]), 5);
  assert.equal(euclideanDistance([1, 2, 3], [1, 2, 3]), 0);
});

test("euclideanDistance: length mismatch throws", () => {
  assert.throws(() => euclideanDistance([1, 2], [1, 2, 3]), /length mismatch/);
});

test("isFaceMatch: threshold boundary (default 0.6)", () => {
  assert.equal(isFaceMatch(0.4), true);
  assert.equal(isFaceMatch(FACE_MATCH_THRESHOLD), true); // at threshold matches
  assert.equal(isFaceMatch(0.61), false);
  assert.equal(isFaceMatch(0.3, 0.35), true); // custom stricter threshold
  assert.equal(isFaceMatch(0.4, 0.35), false);
});

test("matchConfidence: clamps to 0..1", () => {
  assert.equal(matchConfidence(0), 1);
  assert.equal(matchConfidence(0.25), 0.75);
  assert.equal(matchConfidence(1), 0);
  assert.equal(matchConfidence(1.5), 0); // never negative
});

test("serializeDescriptor: Float32Array → number[]", () => {
  const f = new Float32Array([0.5, -0.25, 1]);
  const s = serializeDescriptor(f);
  assert.ok(Array.isArray(s));
  assert.deepEqual(s, [0.5, -0.25, 1]);
});

test("isValidDescriptor: only accepts finite 128-length arrays", () => {
  assert.equal(isValidDescriptor(new Array(DESCRIPTOR_LENGTH).fill(0.1)), true);
  assert.equal(isValidDescriptor(new Array(64).fill(0.1)), false); // wrong length
  assert.equal(isValidDescriptor(null), false);
  assert.equal(isValidDescriptor("nope"), false);
  const withNaN = new Array(DESCRIPTOR_LENGTH).fill(0.1);
  withNaN[0] = NaN;
  assert.equal(isValidDescriptor(withNaN), false);
});

// EAR: eyes ordered [outer, topOuter, topInner, inner, bottomInner, bottomOuter].
function eye(openHeight: number): Point[] {
  // width 10 (outer→inner), symmetric vertical points at ±openHeight/2.
  return [
    { x: 0, y: 0 }, // outer
    { x: 3, y: -openHeight / 2 }, // top outer
    { x: 7, y: -openHeight / 2 }, // top inner
    { x: 10, y: 0 }, // inner
    { x: 7, y: openHeight / 2 }, // bottom inner
    { x: 3, y: openHeight / 2 }, // bottom outer
  ];
}

test("eyeAspectRatio: open eye high, closed eye low", () => {
  const open = eyeAspectRatio(eye(6)); // vertical=6+6=12 / (2*10) = 0.6
  const closed = eyeAspectRatio(eye(0.5)); // 1 / 20 = 0.05
  assert.ok(open > BLINK_EAR_THRESHOLD, `open ${open} should exceed threshold`);
  assert.ok(closed < BLINK_EAR_THRESHOLD, `closed ${closed} below threshold`);
  assert.equal(Math.round(open * 100) / 100, 0.6);
});

test("eyeAspectRatio: wrong point count throws", () => {
  assert.throws(() => eyeAspectRatio([{ x: 0, y: 0 }]), /expected 6 eye points/);
});

test("blinkRatio: averages both eyes", () => {
  assert.equal(blinkRatio(eye(6), eye(6)), 0.6);
});
