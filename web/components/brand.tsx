import Link from "next/link";
import { cn } from "@/lib/utils";

/** KaamSathi logomark: a "K" built from a worker's path, with a crimson sun (flag nod). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path
        d="M10 8v16M10 16.5 19.5 8M13.5 13.5 21 24"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="23.5" cy="9.5" r="2.5" className="fill-coral" />
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
        <span className="text-[17px] font-semibold tracking-tight text-fg">{name}</span>
        {sub ? <span className="mt-0.5 text-[11px] font-medium text-fg-muted">{sub}</span> : null}
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
