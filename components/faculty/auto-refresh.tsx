"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Generic "poll router.refresh() every N seconds" helper.
 *
 * The faculty roster now stays current via Supabase Realtime
 * (components/faculty/realtime-roster.tsx), which uses this pattern only as
 * a slow fallback when the realtime socket can't connect. Kept as a small,
 * dependency-free utility for any view that just wants periodic refresh.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
