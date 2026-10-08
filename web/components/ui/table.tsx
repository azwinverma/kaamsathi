import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Data table per DESIGN.md: dense radius (10px), sticky surface-muted header, 52px rows, money right-aligned tabular.
 * Wrapper scrolls horizontally on small screens; `stickyFirst` keeps the first column pinned.
 */
export function TableContainer({
  className,
  maxHeight,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { maxHeight?: string }) {
  return (
    <div
      className={cn(
        "scrollbar-thin relative w-full overflow-auto rounded-dense border border-border bg-surface shadow-sm",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-separate border-spacing-0 text-sm text-fg-body", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("sticky top-0 z-10", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&>tr:last-child>*]:border-b-0", className)} {...props} />;
}

export function TFoot({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "sticky bottom-0 z-10 bg-surface-muted font-semibold text-fg [&>tr>*]:border-t [&>tr>*]:border-border [&>tr>*]:bg-surface-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  interactive,
  selected,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean; selected?: boolean }) {
  return (
    <tr
      className={cn(
        "group/row",
        interactive && "cursor-pointer hover:[&>*]:bg-surface-hover",
        selected && "[&>*]:bg-brand-subtle",
        className,
      )}
      aria-selected={selected || undefined}
      {...props}
    />
  );
}

export function Th({
  className,
  numeric,
  sticky,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; sticky?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 border-b border-border bg-surface-muted px-4 text-left text-xs font-semibold whitespace-nowrap text-fg-muted",
        numeric && "text-right",
        sticky && "sticky left-0 z-20",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  sticky,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; sticky?: boolean }) {
  return (
    <td
      className={cn(
        "h-[52px] border-b border-border bg-surface px-4 align-middle",
        numeric && "text-right whitespace-nowrap tabular",
        sticky && "sticky left-0 z-[5]",
        className,
      )}
      {...props}
    />
  );
}

/** Row header cell (first column) — semantic <th scope="row">. */
export function RowHeader({
  className,
  sticky,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { sticky?: boolean }) {
  return (
    <th
      scope="row"
      className={cn(
        "h-[52px] border-b border-border bg-surface px-4 text-left align-middle font-medium text-fg",
        sticky && "sticky left-0 z-[5]",
        className,
      )}
      {...props}
    />
  );
}
