"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls router.refresh() so the server-rendered roster stays current
 * while a session is live. Phase 2 swaps this for a Supabase Realtime
 * subscription; polling keeps the MVP dependency-free.
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);

  return null;
}
