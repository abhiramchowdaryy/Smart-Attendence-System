import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the mark-attendance layout: title row, camera square,
 * geofence chip, CTA — so nothing jumps when the session loads.
 */
export default function MarkAttendanceLoading() {
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-64" />
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-11" />
      <Skeleton className="h-12" />
    </div>
  );
}
