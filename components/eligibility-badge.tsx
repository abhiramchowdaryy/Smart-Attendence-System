import { ShieldCheck, ShieldAlert, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isEligible } from "@/lib/attendance";

/**
 * Eligibility pill driven by the single ELIGIBILITY_THRESHOLD. Like the
 * status pill, state is conveyed by icon + label as well as color, never
 * color alone (WCAG 1.4.1). "No data" (conducted 0 → null) is its own
 * neutral state rather than a false "Not eligible".
 */
export function EligibilityBadge({ officialPct }: { officialPct: number | null }) {
  if (officialPct === null) {
    return (
      <Badge variant="outline">
        <CircleDashed className="size-3" aria-hidden="true" />
        No data
      </Badge>
    );
  }
  if (isEligible(officialPct)) {
    return (
      <Badge variant="present">
        <ShieldCheck className="size-3" aria-hidden="true" />
        Eligible
      </Badge>
    );
  }
  return (
    <Badge variant="absent">
      <ShieldAlert className="size-3" aria-hidden="true" />
      Not eligible
    </Badge>
  );
}
