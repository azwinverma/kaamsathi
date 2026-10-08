import * as React from "react";
import Link from "next/link";
import { MARK } from "@/lib/brand-mark";
import { cn } from "@/lib/utils";

/**
 * KaamSathi logomark: a "K" drawn as a worker's path, with a coral sun. Geometry lives in
 * lib/brand-mark.ts (shared with the favicon, apple-icon and public/brand/*.svg).
 * `mono` draws the single-colour version (tile in currentColor, K and sun knocked out).
 */
export function LogoMark({ className, mono }: { className?: string; mono?: boolean }) {
  const maskId = React.useId();
  if (mono) {
    return (
      <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
          <rect width="32" height="32" fill="#fff" />
          <path
            d={MARK.k}
            stroke="#000"
            strokeWidth={MARK.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle {...MARK.sun} fill="#000" />
        </mask>
        <rect
          width="32"
          height="32"
          rx={MARK.radius}
          fill="currentColor"
          mask={`url(#${maskId})`}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx={MARK.radius} className="fill-brand" />
      <path
        d={MARK.k}
        stroke={MARK.hex.k}
        strokeWidth={MARK.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle {...MARK.sun} className="fill-coral" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
  name = "KaamSathi",
  sub,
}: {
  className?: string;
  href?: string | null;
  name?: string;
  sub?: string;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-fg text-[17px] font-semibold tracking-tight">{name}</span>
        {sub ? <span className="text-fg-muted mt-0.5 text-[11px] font-medium">{sub}</span> : null}
      </span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="rounded-md" aria-label={name}>
      {inner}
    </Link>
  );
}
