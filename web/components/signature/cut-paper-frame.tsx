import { cn } from "@/lib/utils";

const TAPE = {
  yellow: "bg-yellow/85",
  teal: "bg-teal/85",
  coral: "bg-coral/85",
} as const;

/**
 * White-bordered print "taped" to a wall, rotated a few degrees. Only for real, consented portraits
 * or clearly labelled illustration placeholders (docs/design/DIRECTION.md §4). The paper stays white
 * in dark mode, so the caption uses the fixed ink colour.
 */
export function CutPaperFrame({
  children,
  caption,
  tag,
  tape = "yellow",
  rotate = -4,
  tapeRotate = 4,
  className,
  padding = "md",
}: {
  children: React.ReactNode;
  caption?: React.ReactNode;
  /** Small label before the caption, e.g. "Illustration" while the photo is not commissioned yet. */
  tag?: string;
  tape?: keyof typeof TAPE | "none";
  rotate?: number;
  tapeRotate?: number;
  className?: string;
  padding?: "sm" | "md";
}) {
  return (
    <figure
      className={cn(
        "ks-paper-shadow relative m-0 bg-white",
        padding === "sm" ? "p-1.5" : "p-2.5 pb-3",
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
      {caption ? (
        <figcaption className="text-on-accent pt-2 text-[13px] leading-snug font-semibold">
          {tag ? (
            <span className="text-on-accent/80 mr-1.5 text-[11px] font-medium tracking-wide uppercase">
              {tag} ·
            </span>
          ) : null}
          {caption}
        </figcaption>
      ) : null}
      {tape !== "none" ? (
        <span
          aria-hidden
          className={cn("absolute -top-2.5 left-1/2 h-[22px] w-[34%] max-w-[76px]", TAPE[tape])}
          style={{ transform: `translateX(-50%) rotate(${tapeRotate}deg)` }}
        />
      ) : null}
    </figure>
  );
}
