// Unit tests for lib/gps-settings.ts — run: node --test lib/gps-settings.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GPS_SETTINGS,
  GPS_LIMITS,
  clampSetting,
} from "./gps-settings.ts";

test("clampSetting: keeps in-range values (rounded)", () => {
  assert.equal(clampSetting("accuracyGraceM", 30), 30);
  assert.equal(clampSetting("accuracyGraceM", 30.6), 31);
  assert.equal(clampSetting("lateAfterMin", 15), 15);
});

test("clampSetting: clamps to min/max", () => {
  assert.equal(
    clampSetting("accuracyGraceM", -5),
    GPS_LIMITS.accuracyGraceM.min
  );
  assert.equal(
    clampSetting("accuracyGraceM", 9999),
    GPS_LIMITS.accuracyGraceM.max
  );
  assert.equal(clampSetting("lateAfterMin", 9999), GPS_LIMITS.lateAfterMin.max);
});

test("clampSetting: non-finite falls back to default", () => {
  assert.equal(
    clampSetting("accuracyGraceM", NaN),
    DEFAULT_GPS_SETTINGS.accuracyGraceM
  );
  assert.equal(
    clampSetting("lateAfterMin", Number("nope")),
    DEFAULT_GPS_SETTINGS.lateAfterMin
  );
});
