import { cn } from "@/lib/utils";

/** Thick rounded paint strokes with one or two spray dots. Decorative; max two per view. */
const VARIANTS = {
  swoosh: {
    viewBox: "0 0 120 70",
    d: "M4 50c18-22 40-34 66-30 18 3 30 12 46 4",
    width: 9,
    dots: [
      [104, 12, 4],
      [114, 20, 2.5],
    ],
  },
  underline: {
    viewBox: "0 0 220 28",
    d: "M6 18c46-9 104-12 196-5",
    width: 8,
    dots: [[212, 6, 3]],
  },
  arc: {
    viewBox: "0 0 100 100",
    d: "M12 84C18 44 48 18 86 14",
    width: 9,
    dots: [
      [92, 32, 4],
      [82, 42, 2.5],
    ],
  },
  zigzag: {
    viewBox: "0 0 160 48",
    d: "M6 36l24-20 22 20 24-20 22 20 24-20 22 20",
    width: 8,
    dots: [[152, 8, 3.5]],
  },
} as const;

const TONES = {
  teal: "stroke-teal fill-teal",
  yellow: "stroke-yellow fill-yellow",
  coral: "stroke-coral fill-coral",
} as const;

export function BrushStroke({
  variant = "swoosh",
  tone = "teal",
  className,
}: {
  variant?: keyof typeof VARIANTS;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <svg
      viewBox={v.viewBox}
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none overflow-visible", TONES[tone], className)}
    >
      <path d={v.d} fill="none" strokeWidth={v.width} strokeLinecap="round" strokeLinejoin="round" />
      {v.dots.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} stroke="none" />
      ))}
    </svg>
  );
}
