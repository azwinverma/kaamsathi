import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import { mediaSrc } from "@/lib/media";

const PALETTE = [
  "bg-primary-100 text-primary-800",
  "bg-accent-50 text-accent-600",
  "bg-success-subtle text-success",
  "bg-warning-subtle text-warning",
  "bg-surface-hover text-fg-body",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dims = { xs: "size-6 text-[10px]", sm: "size-8 text-xs", md: "size-9 text-xs", lg: "size-12 text-sm", xl: "size-16 text-lg" }[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={mediaSrc(src) ?? undefined}
        alt=""
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", dims, className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        PALETTE[hash(name) % PALETTE.length],
        dims,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
