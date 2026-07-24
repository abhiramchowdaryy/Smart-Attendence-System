// ════════════════════════════════════════════════════════════════════
// Web Mercator (EPSG:3857) projection — the pure math behind the
// dependency-free map-pin geofence editor (components/admin/map-picker).
//
// Standard slippy-map convention: tile size 256, world size 256·2^zoom
// pixels. No DOM here, so the projection is unit-tested with node --test;
// the component layers OpenStreetMap raster tiles on top of it.
// ════════════════════════════════════════════════════════════════════

export const TILE_SIZE = 256;

/** Metres per pixel at the equator, zoom 0 (circumference / 256). */
const EQUATOR_MPP = 156543.03392804097;

export interface Point {
  x: number;
  y: number;
}

const clampLat = (lat: number) => Math.max(Math.min(lat, 85.05112878), -85.05112878);

/** Longitude/latitude → absolute world pixel at a zoom level. */
export function project(lng: number, lat: number, zoom: number): Point {
  const worldPx = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * worldPx;
  const latRad = (clampLat(lat) * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * worldPx;
  return { x, y };
}

/** Absolute world pixel → longitude/latitude at a zoom level. */
export function unproject(x: number, y: number, zoom: number): { lng: number; lat: number } {
  const worldPx = TILE_SIZE * 2 ** zoom;
  const lng = (x / worldPx) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldPx)));
  return { lng, lat: (latRad * 180) / Math.PI };
}

/** Ground resolution in metres per pixel at a latitude + zoom. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EQUATOR_MPP * Math.cos((clampLat(lat) * Math.PI) / 180)) / 2 ** zoom;
}

export interface TileRef {
  /** Tile column (wrapped into 0..2^zoom-1 for the URL). */
  x: number;
  /** Tile row. */
  y: number;
  z: number;
  /** Screen offset of the tile's top-left corner within the viewport. */
  left: number;
  top: number;
}

/**
 * The tiles needed to paint a viewport centred on (lng, lat), plus each
 * tile's screen position. The centre maps to the middle of the viewport.
 */
export function tilesForViewport(
  center: { lng: number; lat: number },
  zoom: number,
  width: number,
  height: number
): TileRef[] {
  const n = 2 ** zoom;
  const c = project(center.lng, center.lat, zoom);
  // World pixel at the viewport's top-left corner.
  const originX = c.x - width / 2;
  const originY = c.y - height / 2;

  const minTileX = Math.floor(originX / TILE_SIZE);
  const maxTileX = Math.floor((originX + width) / TILE_SIZE);
  const minTileY = Math.floor(originY / TILE_SIZE);
  const maxTileY = Math.floor((originY + height) / TILE_SIZE);

  const tiles: TileRef[] = [];
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    if (ty < 0 || ty >= n) continue; // no tiles above/below the world
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      tiles.push({
        x: ((tx % n) + n) % n, // wrap horizontally (antimeridian)
        y: ty,
        z: zoom,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/**
 * New centre after dragging the map by (dxPx, dyPx) screen pixels. Dragging
 * the map right (positive dx) reveals area to the west, so the centre moves
 * west — hence the subtraction.
 */
export function panCenter(
  center: { lng: number; lat: number },
  zoom: number,
  dxPx: number,
  dyPx: number
): { lng: number; lat: number } {
  const c = project(center.lng, center.lat, zoom);
  return unproject(c.x - dxPx, c.y - dyPx, zoom);
}
