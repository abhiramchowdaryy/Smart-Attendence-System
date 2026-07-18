import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline form feedback banner. One source of truth for the
 * icon + tint + AA-safe text color combination that every form used
 * to hand-roll. `error` announces assertively (role=alert); `success`
 * politely (role=status).
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md p-3 text-sm",
        isError
          ? "bg-destructive/10 text-error"
          : "bg-status-present/10 text-status-present-strong",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
