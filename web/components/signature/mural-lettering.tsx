import { cn } from "@/lib/utils";

const SIZES = {
  sm: "text-[34px]",
  md: "text-[56px] sm:text-[72px]",
  lg: "text-[76px] sm:text-[104px] lg:text-[124px]",
  watermark: "text-[96px] sm:text-[120px]",
} as const;

/**
 * Hand-lettered Devanagari word (काम, सीप, साथी …) in yellow with an offset coral/ink shadow, slightly
 * rotated, for blue grounds. Purely decorative: aria-hidden, never carries meaning on its own, and at
 * most one per view (docs/design/DIRECTION.md §2).
 */
export function MuralLettering({
  word,
  size = "lg",
  rotate = -3,
  shadow = "soft",
  className,
}: {
  word: string;
  size?: keyof typeof SIZES;
  /** Degrees; keep within ±10. */
  rotate?: number;
  /** "soft" = coral + translucent ink; "ink" = coral + solid ink (for light grounds). */
  shadow?: "soft" | "ink";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      lang="ne"
      className={cn("ks-mural", shadow === "ink" && "ks-mural-ink", SIZES[size], className)}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {word}
    </span>
  );
}
