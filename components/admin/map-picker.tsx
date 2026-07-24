"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  metersPerPixel,
  panCenter,
  tilesForViewport,
} from "@/lib/webmercator";

const MIN_ZOOM = 3;
const MAX_ZOOM = 19; // OpenStreetMap raster tiles top out here
const HEIGHT = 288;

/**
 * Dependency-free slippy map for placing a geofence pin.
 *
 * A fixed centre crosshair marks the selected point; dragging pans the map
 * underneath it (so the crosshair always *is* the chosen lat/lng), and a
 * translucent circle previews the geofence radius to scale. Raster tiles
 * come straight from OpenStreetMap — no map library, no API key. The
 * projection math lives in lib/webmercator.ts (unit-tested).
 *
 * Controlled: `lat`/`lng` are owned by the parent form; every pan calls
 * onChange so the parent's inputs stay authoritative.
 */
export function MapPicker({
  lat,
  lng,
  radiusM,
  onChange,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  onChange: (coords: { lat: number; lng: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(16);
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Measure the container so tile coverage matches the rendered width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles =
    width > 0 ? tilesForViewport({ lng, lat }, zoom, width, HEIGHT) : [];

  const mpp = metersPerPixel(lat, zoom);
  const circleDiameter = mpp > 0 ? (2 * radiusM) / mpp : 0;

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || !last.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    onChange(panCenter({ lng, lat }, zoom, dx, dy));
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    dragging.current = false;
    last.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer may already be released — safe to ignore.
    }
  }

  const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative touch-none overflow-hidden rounded-md border bg-muted"
        style={{ height: HEIGHT, cursor: dragging.current ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="application"
        aria-label="Map — drag to place the geofence centre"
      >
        {/* Tiles */}
        {tiles.map((t) => (
          <img
            key={`${t.z}/${t.x}/${t.y}`}
            src={`https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{ left: t.left, top: t.top, width: 256, height: 256 }}
          />
        ))}

        {/* Radius preview circle, centred on the viewport */}
        {circleDiameter > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border-2 border-primary/70 bg-primary/15"
            style={{
              width: circleDiameter,
              height: circleDiameter,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}

        {/* Centre crosshair pin */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
        />

        {/* Zoom controls */}
        <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border bg-card shadow">
          <button
            type="button"
            aria-label="Zoom in"
            className="flex size-8 items-center justify-center hover:bg-muted disabled:opacity-40"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => clampZoom(z + 1))}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            className="flex size-8 items-center justify-center border-t hover:bg-muted disabled:opacity-40"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => clampZoom(z - 1))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Coordinate readout */}
        <div className="absolute bottom-1 left-1 rounded bg-card/85 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>

        {/* Attribution — required by the OSM tile usage policy */}
        <div className="absolute bottom-1 right-1 rounded bg-card/85 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          ©{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            OpenStreetMap
          </a>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Drag the map so the pin sits on the classroom. The shaded circle is the
        geofence radius to scale.
      </p>
    </div>
  );
}
