import {
  Award,
  ThumbsUp,
  Minus,
  AlertTriangle,
  XCircle,
  CircleDashed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LetterGrade } from "@/lib/results";

/**
 * Letter-grade pill. As with status pills, the tone is carried by icon +
 * letter together, never color alone (WCAG 1.4.1).
 */
const CONFIG: Record<
  LetterGrade,
  { variant: "present" | "secondary" | "late" | "absent"; Icon: typeof Award }
> = {
  S: { variant: "present", Icon: Award },
  A: { variant: "present", Icon: ThumbsUp },
  B: { variant: "secondary", Icon: ThumbsUp },
  C: { variant: "secondary", Icon: Minus },
  D: { variant: "late", Icon: AlertTriangle },
  E: { variant: "late", Icon: AlertTriangle },
  F: { variant: "absent", Icon: XCircle },
};

export function GradeBadge({ grade }: { grade: LetterGrade | null }) {
  if (grade === null) {
    return (
      <Badge variant="outline">
        <CircleDashed className="size-3" aria-hidden="true" />
        —
      </Badge>
    );
  }
  const { variant, Icon } = CONFIG[grade];
  return (
    <Badge variant={variant} className="font-display text-sm font-bold">
      <Icon className="size-3" aria-hidden="true" />
      {grade}
    </Badge>
  );
}
