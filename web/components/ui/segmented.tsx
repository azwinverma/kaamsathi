"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Radio-group styled as a segmented control (few, mutually exclusive options). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const name = React.useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-md border border-border bg-surface-muted p-0.5", className)}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              "relative inline-flex cursor-pointer items-center justify-center rounded-[6px] px-3 font-medium whitespace-nowrap text-fg-muted transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              size === "sm" ? "h-7 text-xs" : "h-8 text-sm",
              checked ? "bg-surface text-fg shadow-sm" : "hover:text-fg",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
