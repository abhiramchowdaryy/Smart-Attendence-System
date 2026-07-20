-- ════════════════════════════════════════════════════════════════════
-- Phase 2 · Migration 0005 — face enrolment status flag
--
-- The admin user table needs to show *whether* a student has enrolled a
-- face, not the descriptor itself. Selecting profiles.face_embedding just
-- to test it for NULL would ship 128 floats per user to the server on
-- every admin dashboard render — at institution scale that is megabytes
-- of pointless transfer.
--
-- A stored generated column gives the same answer in one byte and is
-- cheap to index, so the roster query stays flat as the user count grows.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists face_enrolled boolean
  generated always as (face_embedding is not null) stored;

-- Supports "who still needs to enrol?" roster filtering.
create index if not exists profiles_face_enrolled_idx
  on public.profiles (face_enrolled);

comment on column public.profiles.face_enrolled is
  'Derived: whether a face descriptor is enrolled. Enrolment is first-write-only in the app layer; admins clear face_embedding to allow re-enrolment.';
