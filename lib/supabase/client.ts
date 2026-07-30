import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/utils";

/**
 * Browser Supabase client (anon key + user JWT; RLS enforces access).
 *
 * A single shared instance persists the session in localStorage and refreshes
 * tokens automatically — this replaces the SSR cookie flow the Next.js build
 * used. `detectSessionInUrl` lets the OAuth callback route complete the PKCE
 * exchange from the redirect URL.
 */
let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;
  if (!supabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY."
    );
  }
  client = createSupabaseClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }
  );
  return client;
}
