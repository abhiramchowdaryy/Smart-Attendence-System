"use client";

import { useEffect } from "react";

/**
 * Generic "call onRefresh() every N seconds" helper. The faculty roster stays
 * current via Supabase Realtime (components/faculty/realtime-roster.tsx); this
 * is the slow fallback. In the SSR build it called router.refresh(); now the
 * caller passes a refetch/invalidate callback.
 */
export function AutoRefresh({
  seconds = 15,
  onRefresh,
}: {
  seconds?: number;
  onRefresh: () => void;
}) {
  useEffect(() => {
    const id = setInterval(onRefresh, seconds * 1000);
    return () => clearInterval(id);
  }, [onRefresh, seconds]);

  return null;
}
