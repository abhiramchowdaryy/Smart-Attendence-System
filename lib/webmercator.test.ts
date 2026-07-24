// Unit tests for lib/webmercator.ts — run: node --test lib/webmercator.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  project,
  unproject,
  metersPerPixel,
  panCenter,
  tilesForViewport,
  TILE_SIZE,
} from "./webmercator.ts";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

test("project: (0,0) sits at the centre of the world at zoom 0", () => {
  const p = project(0, 0, 0);
  assert.ok(near(p.x, TILE_SIZE / 2));
  assert.ok(near(p.y, TILE_SIZE / 2));
});

test("project: longitude maps linearly across the world width", () => {
  const worldPx = TILE_SIZE * 2 ** 3;
  assert.ok(near(project(-180, 0, 3).x, 0));
  assert.ok(near(project(180, 0, 3).x, worldPx));
});

test("project/unproject: round-trip preserves lng/lat", () => {
  for (const [lng, lat] of [
    [77.5358, 12.9351],
    [-122.4194, 37.7749],
    [0, 0],
    [151.2093, -33.8688],
  ]) {
    const p = project(lng, lat, 17);
    const back = unproject(p.x, p.y, 17);
    assert.ok(near(back.lng, lng, 1e-6), `lng ${back.lng} vs ${lng}`);
    assert.ok(near(back.lat, lat, 1e-6), `lat ${back.lat} vs ${lat}`);
  }
});

test("metersPerPixel: ~156543 at the equator, zoom 0; halves each zoom", () => {
  assert.ok(near(metersPerPixel(0, 0), 156543.03392804097, 1e-3));
  assert.ok(near(metersPerPixel(0, 1), 156543.03392804097 / 2, 1e-3));
  // Shrinks with latitude (cos factor).
  assert.ok(metersPerPixel(60, 10) < metersPerPixel(0, 10));
});

test("panCenter: dragging back to origin restores the centre", () => {
  const start = { lng: 77.5358, lat: 12.9351 };
  const moved = panCenter(start, 17, 50, -30);
  const restored = panCenter(moved, 17, -50, 30);
  assert.ok(near(restored.lng, start.lng, 1e-9));
  assert.ok(near(restored.lat, start.lat, 1e-9));
});

test("tilesForViewport: covers the viewport and centres correctly", () => {
  const tiles = tilesForViewport({ lng: 0, lat: 0 }, 2, 300, 300);
  assert.ok(tiles.length > 0);
  // Every tile is a valid column/row at this zoom (0..3).
  for (const t of tiles) {
    assert.ok(t.x >= 0 && t.x < 4);
    assert.ok(t.y >= 0 && t.y < 4);
    assert.equal(t.z, 2);
  }
  // The viewport centre (150,150) must fall inside some tile's square.
  const covers = tiles.some(
    (t) =>
      150 >= t.left &&
      150 < t.left + TILE_SIZE &&
      150 >= t.top &&
      150 < t.top + TILE_SIZE
  );
  assert.ok(covers);
});
