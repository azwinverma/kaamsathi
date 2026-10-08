import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { CutPaperFrame } from "./cut-paper-frame";
import { DotTexture } from "./dot-texture";
import { MuralLettering } from "./mural-lettering";

export interface PassportCardChip {
  label: string;
  accent?: boolean;
}

/**
 * The Skill Passport identity card (B · street mural): skill gradient on deep brand blue, dot grain,
 * सीप watermark, cut-paper photo frame. Used by the public Passport (/p/...) and, with demo data, on
 * the home page. Presentational: callers pass translated strings.
 *
 * Contrast: the skill gradient runs at 60% over `hero` (#172554), so white text stays ≥ 4.8:1 even at
 * the teal corner.
 */
export function PassportCard({
  brand,
  code,
  name,
  altName,
  altLang,
  line,
  photoUrl,
  initials,
  photoLabel,
  chips,
  verifiedLabel,
  headingAs: Heading = "p",
  headingId,
  className,
}: {
  brand: string;
  code?: string | null;
  name: string;
  altName?: string | null;
  altLang?: "en" | "ne";
  /** e.g. "Cook · Kathmandu" */
  line?: string | null;
  photoUrl?: string | null;
  initials: string;
  photoLabel: string;
  chips: PassportCardChip[];
  verifiedLabel?: string;
  headingAs?: "h1" | "h2" | "p";
  headingId?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-hero text-hero-fg relative isolate overflow-hidden rounded-sheet p-5 [print-color-adjust:exact] sm:p-7",
        className,
      )}
    >
      <span aria-hidden className="bg-skill-gradient absolute inset-0 -z-10 opacity-60" />
      <DotTexture size={12} className="-z-10" />
      <MuralLettering
        word="सीप"
        size="watermark"
        rotate={-8}
        className="absolute -right-3 -bottom-12 -z-10 sm:-bottom-14"
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-hero-fg text-xs font-bold tracking-[0.12em]">
          {brand}
          {code ? <span className="tabular ml-2 font-semibold tracking-[0.08em]">{code}</span> : null}
        </p>
        {verifiedLabel ? (
          <span className="text-hero-fg inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-white/12 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/25">
            <ShieldCheck className="size-3.5" aria-hidden />
            {verifiedLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-4 sm:gap-5">
        <CutPaperFrame padding="sm" rotate={-4} tapeRotate={6} className="w-[84px] shrink-0 sm:w-[104px]">
          <div className="bg-hero-muted relative aspect-[4/5] w-full overflow-hidden">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- media URLs come from the API host
              <img src={photoUrl} alt={photoLabel} className="size-full object-cover" />
            ) : (
              <span
                className="text-hero flex size-full items-center justify-center text-2xl font-extrabold sm:text-3xl"
                aria-hidden
              >
                {initials}
              </span>
            )}
          </div>
        </CutPaperFrame>
        <div className="min-w-0 flex-1">
          <Heading
            id={headingId}
            className="text-hero-fg text-2xl leading-tight font-extrabold tracking-tight break-words sm:text-3xl"
          >
            {name}
          </Heading>
          {altName ? (
            <p className="text-hero-fg mt-0.5 text-sm" lang={altLang}>
              {altName}
            </p>
          ) : null}
          {line ? <p className="text-hero-fg mt-1.5 text-sm font-semibold">{line}</p> : null}
        </div>
      </div>

      {chips.length ? (
        <ul className="relative mt-5 flex flex-wrap gap-2 pr-16 sm:pr-24">
          {chips.map((c) => (
            <li
              key={c.label}
              className={cn(
                "text-on-accent rounded-pill px-2.5 py-1 text-xs font-bold",
                c.accent ? "bg-yellow" : "bg-white",
              )}
            >
              {c.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
