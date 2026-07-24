"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the server-rendered live roster current using Supabase Realtime
 * instead of the old fixed 15 s poll.
 *
 * It subscribes to Postgres change events on `attendance` (entries + exits,
 * scoped to this session) and `sessions` (so a close is reflected at once),
 * calling router.refresh() to re-fetch the server component. RLS still
 * governs the stream — staff read all rows, so faculty receive every mark.
 *
 * A slow fallback poll (default 60 s, vs the previous 15 s) covers the rare
 * case where the realtime socket never connects (blocked WebSocket, project
 * without the 0008 migration): the roster stays correct, just less instant.
 * The moment realtime subscribes successfully the fallback is cancelled.
 */
export function RealtimeRoster({
  sessionId,
  fallbackSeconds = 60,
}: {
  sessionId: string;
  fallbackSeconds?: number;
}) {
  const router = useRouter();
  // router identity is stable across renders in the App Router, but capture it
  // in a ref so the effect can depend only on sessionId (no reconnect churn).
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    const supabase = createClient();
    let fallback: ReturnType<typeof setInterval> | null = null;
    // Guards against a late CLOSED status callback (fired by removeChannel on
    // unmount) re-arming the fallback after cleanup has already cleared it.
    let disposed = false;
    const refresh = () => routerRef.current.refresh();

    const startFallback = () => {
      if (disposed) return;
      if (fallback === null) {
        fallback = setInterval(refresh, fallbackSeconds * 1000);
      }
    };
    const stopFallback = () => {
      if (fallback !== null) {
        clearInterval(fallback);
        fallback = null;
      }
    };

    const channel = supabase
      .channel(`roster:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
          filter: `session_id=eq.${sessionId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        refresh
      )
      .subscribe((status) => {
        // Only lean on polling while realtime is NOT healthy.
        if (status === "SUBSCRIBED") stopFallback();
        else startFallback();
      });

    // Cover the initial connect window before the first status callback.
    startFallback();

    return () => {
      disposed = true;
      stopFallback();
      supabase.removeChannel(channel);
    };
  }, [sessionId, fallbackSeconds]);

  return null;
}
