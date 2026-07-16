import { CheckCircle2, Clock, XCircle, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AttendanceStatus } from "@/lib/utils";

/**
 * Attendance status pill. Icon + label always accompany the color so the
 * state is never conveyed by color alone (WCAG 1.4.1).
 */
const CONFIG: Record<
  AttendanceStatus,
  { label: string; Icon: typeof CheckCircle2 }
> = {
  present: { label: "Present", Icon: CheckCircle2 },
  late: { label: "Late", Icon: Clock },
  absent: { label: "Absent", Icon: XCircle },
  partial: { label: "Left early", Icon: LogOut },
};

export function StatusPill({ status }: { status: AttendanceStatus }) {
  const { label, Icon } = CONFIG[status];
  return (
    <Badge variant={status}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
