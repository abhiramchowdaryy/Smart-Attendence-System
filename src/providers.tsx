import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/lib/auth";

/**
 * App-wide client providers. TanStack Query backs the dashboards and realtime
 * views (Supabase Realtime events invalidate queries); AuthProvider replaces
 * the SSR session/middleware. Per-page <title> is handled by <PageTitle>, which
 * relies on React 19's native document-metadata hoisting (was the Next Metadata
 * API, then react-helmet-async).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
