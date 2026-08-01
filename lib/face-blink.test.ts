import { describe, expect, it } from "vitest";
import { initBlinkState, updateBlinkState } from "@/lib/face";

/** Feed a sequence of EAR samples through the detector and return final state. */
function run(ears: number[]) {
  return ears.reduce((s, ear) => updateBlinkState(s, ear), initBlinkState());
}

describe("adaptive blink detector", () => {
  it("counts a single open → closed → open blink", () => {
    // Resting EAR ~0.30, dips to ~0.10 for the blink, recovers.
    const s = run([0.3, 0.3, 0.1, 0.09, 0.3, 0.31]);
    expect(s.count).toBe(1);
    expect(s.closed).toBe(false);
  });

  it("does not count while eyes stay open", () => {
    expect(run([0.3, 0.31, 0.29, 0.3, 0.3]).count).toBe(0);
  });

  it("works for a low resting EAR that fixed thresholds would miss", () => {
    // Resting EAR ~0.24 (would sit in the old 0.22–0.28 dead zone forever).
    const s = run([0.24, 0.24, 0.12, 0.11, 0.24, 0.25]);
    expect(s.count).toBe(1);
  });

  it("counts multiple distinct blinks", () => {
    const s = run([0.3, 0.1, 0.3, 0.3, 0.1, 0.3]);
    expect(s.count).toBe(2);
  });

  it("does not double-count a single sustained closure (hysteresis)", () => {
    const s = run([0.3, 0.1, 0.1, 0.1, 0.1, 0.3]);
    expect(s.count).toBe(1);
  });

  it("ignores non-finite / non-positive samples", () => {
    const s = run([0.3, Number.NaN, 0, -1, 0.1, 0.3]);
    expect(s.count).toBe(1);
  });
});
