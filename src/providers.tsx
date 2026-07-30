import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";

/**
 * App-wide client providers. TanStack Query backs the dashboards and realtime
 * views (Supabase Realtime events invalidate queries); AuthProvider replaces
 * the SSR session/middleware; Helmet manages per-page <title> (was the Next
 * Metadata API).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      })
  );

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
