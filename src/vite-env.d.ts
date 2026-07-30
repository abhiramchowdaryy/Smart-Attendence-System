/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_COLLEGE_DOMAIN?: string;
  /** "true" enables the server-side DeepFace path via the face-represent /
   *  face-verify edge functions. The FACE_SERVICE secrets live only in those
   *  functions — this flag is a non-secret UI/behaviour switch. */
  readonly VITE_FACE_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
