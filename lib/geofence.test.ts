// Unit tests for lib/geofence.ts — run: node --test lib/geofence.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveGraceM, haversineWithin } from "./geofence.ts";

test("effectiveGraceM: caps accuracy at the admin grace", () => {
  assert.equal(effectiveGraceM(40, 25), 25); // accuracy worse than cap → cap
  assert.equal(effectiveGraceM(10, 25), 10); // accuracy better than cap → accuracy
  assert.equal(effectiveGraceM(0, 25), 0);
});

test("effectiveGraceM: clamps negatives and non-finite to a safe number", () => {
  assert.equal(effectiveGraceM(-5, 25), 0);
  assert.equal(effectiveGraceM(NaN, 25), 0);
  assert.equal(effectiveGraceM(10, -5), 0); // negative cap → no grace
  assert.equal(effectiveGraceM(10, NaN), 0);
});

test("haversineWithin: inside the radius is within, source is haversine", () => {
  const fence = { lat: 12.9351, lng: 77.5358 };
  const res = haversineWithin(fence, fence, 100, 0);
  assert.equal(res.within, true);
  assert.equal(res.source, "haversine");
  assert.ok(res.distanceM < 1);
  assert.equal(res.allowedM, 100);
});

test("haversineWithin: grace extends the allowed radius", () => {
  const fence = { lat: 12.9351, lng: 77.5358 };
  // ~0.0018° of latitude ≈ 200 m north of the fence.
  const point = { lat: fence.lat + 0.0018, lng: fence.lng };
  const tight = haversineWithin(point, fence, 100, 0);
  assert.equal(tight.within, false); // ~200 m > 100 m radius
  const loose = haversineWithin(point, fence, 100, 120);
  assert.equal(loose.within, true); // 100 + 120 = 220 m allowance
  assert.equal(loose.allowedM, 220);
});

test("haversineWithin: exactly on the boundary counts as within", () => {
  const fence = { lat: 0, lng: 0 };
  const res = haversineWithin(fence, fence, 0, 0);
  assert.equal(res.distanceM, 0);
  assert.equal(res.within, true); // distance <= allowed
});
