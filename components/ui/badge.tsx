import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        /* Tinted fills + -strong text keeps the pills ≥4.5:1 (AA) */
        present:
          "border-transparent bg-status-present/15 text-status-present-strong",
        late: "border-transparent bg-status-late/15 text-status-late-strong",
        absent:
          "border-transparent bg-status-absent/15 text-status-absent-strong",
        partial:
          "border-transparent bg-status-partial/15 text-status-partial-strong",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
