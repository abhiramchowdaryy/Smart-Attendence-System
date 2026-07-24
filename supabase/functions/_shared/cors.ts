// Shared CORS headers for Supabase Edge Functions. The app calls these via
// supabase.functions.invoke() from the browser and from server actions, so a
// permissive CORS policy is fine — every function still verifies the caller's
// JWT and role before doing anything.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
