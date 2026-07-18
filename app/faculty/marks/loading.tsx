import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the marks page: heading + two side-by-side cards. */
export default function MarksLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Skeleton className="h-[26rem]" />
        <Skeleton className="h-[26rem]" />
      </div>
    </div>
  );
}
