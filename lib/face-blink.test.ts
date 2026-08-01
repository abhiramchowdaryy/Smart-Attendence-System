// Unit tests for the adaptive blink detector in lib/face.ts —
// run: node --test lib/face-blink.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { initBlinkState, updateBlinkState } from "./face.ts";

/** Feed a sequence of EAR samples through the detector; return the final state. */
function run(ears: number[]) {
  return ears.reduce((s, ear) => updateBlinkState(s, ear), initBlinkState());
}

test("counts a single open → closed → open blink", () => {
  // Resting EAR ~0.30, dips to ~0.10 for the blink, recovers.
  const s = run([0.3, 0.3, 0.1, 0.09, 0.3, 0.31]);
  assert.equal(s.count, 1);
  assert.equal(s.closed, false);
});

test("does not count while eyes stay open", () => {
  assert.equal(run([0.3, 0.31, 0.29, 0.3, 0.3]).count, 0);
});

test("works for a low resting EAR that fixed thresholds would miss", () => {
  // Resting EAR ~0.24 (would sit in the old 0.22–0.28 dead zone forever).
  assert.equal(run([0.24, 0.24, 0.12, 0.11, 0.24, 0.25]).count, 1);
});

test("counts multiple distinct blinks", () => {
  assert.equal(run([0.3, 0.1, 0.3, 0.3, 0.1, 0.3]).count, 2);
});

test("does not double-count a single sustained closure (hysteresis)", () => {
  assert.equal(run([0.3, 0.1, 0.1, 0.1, 0.1, 0.3]).count, 1);
});

test("ignores non-finite / non-positive samples", () => {
  assert.equal(run([0.3, Number.NaN, 0, -1, 0.1, 0.3]).count, 1);
});
