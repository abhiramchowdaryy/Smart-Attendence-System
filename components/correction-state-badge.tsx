import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type CorrectionState = "pending" | "approved" | "rejected";

/** State pill for a correction request — icon + label, never color alone. */
const CONFIG: Record<
  CorrectionState,
  { label: string; variant: "late" | "present" | "absent"; Icon: typeof Clock }
> = {
  pending: { label: "Pending", variant: "late", Icon: Clock },
  approved: { label: "Approved", variant: "present", Icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "absent", Icon: XCircle },
};

export function CorrectionStateBadge({ state }: { state: CorrectionState }) {
  const { label, variant, Icon } = CONFIG[state];
  return (
    <Badge variant={variant}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}
