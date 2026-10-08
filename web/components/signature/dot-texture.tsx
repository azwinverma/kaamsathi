import { cn } from "@/lib/utils";

/** Fine spray-paint dot grain laid over a ground. Decorative (aria-hidden), fills its positioned parent. */
export function DotTexture({
  tone = "light",
  size = 14,
  className,
}: {
  /** "light" for blue/gradient grounds, "ink" for pale grounds. */
  tone?: "light" | "ink";
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        tone === "light" ? "ks-dots-light" : "ks-dots-ink",
        className,
      )}
      style={size !== 14 ? { backgroundSize: `${size}px ${size}px` } : undefined}
    />
  );
}
