import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared data-table primitives. Every table in the app renders through
 * these so column headers, row hover and cell rhythm stay identical.
 *
 * Sticky headers: give TableContainer a max-height (e.g. "max-h-96")
 * and set `sticky` on THead — header cells then pin inside the scroll
 * container (sticky is applied per-<th> for Safari).
 */
const TableContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("overflow-auto", className)} {...props} />
));
TableContainer.displayName = "TableContainer";

const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <table ref={ref} className={cn("w-full text-sm", className)} {...props} />
));
Table.displayName = "Table";

/** Renders <thead><tr> in one go — children are <Th> cells. */
function THead({
  sticky = false,
  className,
  children,
}: {
  sticky?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <thead
      className={cn(
        "text-left text-xs uppercase tracking-wide text-muted-foreground",
        sticky &&
          "[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card",
        className
      )}
    >
      <tr className="[&_th]:border-b">{children}</tr>
    </thead>
  );
}

const Th = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn("py-2 pr-4 font-medium", className)}
    {...props}
  />
));
Th.displayName = "Th";

const Tr = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors last:border-0 hover:bg-muted/50",
      className
    )}
    {...props}
  />
));
Tr.displayName = "Tr";

const Td = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("py-2.5 pr-4", className)} {...props} />
));
Td.displayName = "Td";

export { TableContainer, Table, THead, Th, Tr, Td };
