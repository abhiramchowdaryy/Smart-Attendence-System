-- ════════════════════════════════════════════════════════════════════
-- Phase 2+ · Migration 0006 — server-side DeepFace embedding
--
-- The base app stores a 128-d browser (face-api) descriptor in
-- profiles.face_embedding and re-checks the *match decision* server-side.
-- The DeepFace hardening (FACE_SERVICE_URL) goes one step further: it
-- computes the embedding from raw pixels on the server, so the browser can
-- no longer assert its own identity.
--
-- That server embedding is produced by a DIFFERENT model (e.g. Facenet512 →
-- 512 floats), so it cannot reuse face_embedding (guarded as exactly 128-d
-- in the app layer). It gets its own nullable column, populated at enrolment
-- only when the service is configured. Existing enrolments keep working: a
-- NULL here means "no server embedding yet", and the app falls back to the
-- descriptor match until the student re-enrols with the service enabled.
-- ════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists face_embedding_server jsonb;

comment on column public.profiles.face_embedding_server is
  'Server-computed DeepFace embedding (variable length by model), set at '
  'enrolment when FACE_SERVICE_URL is configured. NULL = fall back to the '
  'browser-descriptor match in face_embedding. Reset alongside face_embedding '
  'when an admin clears an enrolment.';

-- The face_enrolled generated flag (migration 0005) intentionally stays keyed
-- to face_embedding: a student is "enrolled" the moment the descriptor exists,
-- whether or not the optional server embedding was also captured.
