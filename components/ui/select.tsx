import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Styled native <select> — matches Input's height (h-11 = 44px touch
 * target) and focus treatment. Native so it stays keyboard- and
 * mobile-picker-friendly with zero dependency cost.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    // Password managers/extensions inject attributes pre-hydration.
    suppressHydrationWarning
    className={cn(
      "flex h-11 w-full cursor-pointer rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Select.displayName = "Select";

export { Select };
