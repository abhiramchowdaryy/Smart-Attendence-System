-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0007 — PostGIS ST_DWithin geofencing
-- Run AFTER the earlier migrations, in Supabase → SQL Editor.
--
-- The MVP checks the geofence with a Haversine distance computed in the
-- server action (and mirrored in TypeScript for the client UX). That is
-- correct but hand-rolled. This migration moves the *authoritative*
-- containment test into the database using PostGIS geography + ST_DWithin,
-- which uses a spheroidal model and is index-accelerated (GiST).
--
-- Non-breaking: the app calls the geofence_check() RPC and falls back to
-- the TS Haversine path if PostGIS is unavailable (see lib/geofence.ts),
-- so an environment that skips this migration keeps working.
--
-- On Supabase, PostGIS installs into the `extensions` schema; the leading
-- search_path makes st_* / geography resolvable for the statements below.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists postgis with schema extensions;

set search_path = public, extensions;

-- ── Geography column, generated from the existing lat/lng ─────────────
-- lng first: PostGIS points are (X = longitude, Y = latitude). Kept in
-- sync automatically, so the admin UI still edits plain lat/lng numbers.
alter table public.geofences
  add column if not exists geog geography(Point, 4326)
  generated always as
    (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::geography)
  stored;

-- GiST index so ST_DWithin scales past a handful of classrooms.
create index if not exists geofences_geog_idx
  on public.geofences using gist (geog);

comment on column public.geofences.geog is
  'Generated PostGIS geography point (lng, lat) mirroring the numeric '
  'lat/lng columns. Backs ST_DWithin containment in geofence_check().';

-- ── Authoritative containment test ───────────────────────────────────
-- Given a session and a candidate reading, returns the spheroidal
-- distance, the allowed radius (fence radius + caller-supplied grace),
-- and whether the point is within. The caller (mark-attendance action)
-- computes the grace as min(gps_accuracy, admin_grace) so the PostGIS
-- and Haversine paths apply an identical allowance.
--
-- security invoker (default): the caller's RLS governs which sessions /
-- geofences are visible — both are readable by any authenticated user.
create or replace function public.geofence_check(
  p_session_id uuid,
  p_lat        double precision,
  p_lng        double precision,
  p_grace_m    double precision default 0
)
returns table (
  distance_m double precision,
  allowed_m  double precision,
  within     boolean
)
language sql
stable
set search_path = public, extensions
as $$
  select
    extensions.st_distance(
      g.geog,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography
    ) as distance_m,
    g.radius_m + greatest(p_grace_m, 0) as allowed_m,
    extensions.st_dwithin(
      g.geog,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::geography,
      g.radius_m + greatest(p_grace_m, 0)
    ) as within
  from public.sessions s
  join public.geofences g on g.id = s.geofence_id
  where s.id = p_session_id;
$$;

comment on function public.geofence_check(uuid, double precision, double precision, double precision) is
  'Authoritative geofence containment for a session using ST_DWithin. '
  'Returns spheroidal distance, allowed radius (fence radius + grace) and a '
  'within flag. Grace is supplied by the caller as min(gps_accuracy, admin grace).';

grant execute on function
  public.geofence_check(uuid, double precision, double precision, double precision)
  to authenticated;
