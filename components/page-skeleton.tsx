import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic route-transition skeleton.
 *
 * Every authenticated page is a Server Component that awaits Supabase, so
 * without a loading boundary a click on the nav leaves the old page frozen
 * on screen for the whole round-trip with no acknowledgement. Section-level
 * `loading.tsx` files render this so navigation is always visibly
 * instantaneous even when the data is not.
 *
 * The proportions deliberately mirror the common page shape (title block,
 * KPI row, one wide card) so the swap to real content doesn't shift layout.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px]" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
