import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { SLOTS, slotAspect, type SlotId } from "@/components/marketing/slots";
import { cn } from "@/lib/utils";
import { slotBriefsVisible } from "./slot-briefs";

const found = new Map<SlotId, string | null>();

/** Public URL of the commissioned photo for a slot, or null while only the illustration exists. */
export function slotPhoto(id: SlotId): string | null {
  const hit = found.get(id);
  if (hit !== undefined) return hit;
  let url: string | null = null;
  for (const ext of ["webp", "jpg"]) {
    try {
      if (existsSync(path.join(process.cwd(), "public", "images", "photos", `${id}.${ext}`))) {
        url = `/images/photos/${id}.${ext}`;
        break;
      }
    } catch {
      // Missing public dir (unusual deploys): fall back to the illustration.
    }
  }
  // In development keep re-checking so a dropped-in photo shows up without a restart.
  if (process.env.NODE_ENV === "production") found.set(id, url);
  return url;
}

/**
 * Art-directed image slot: fixed aspect ratio, the commissioned photo when present, otherwise the
 * illustrated fallback from the kit. Alt text is required (it describes the subject, which is the
 * same for photo and illustration). The shot description shows only in dev or with `?slots=1`.
 */
export function ImageSlot({
  slot,
  alt,
  sizes = "(min-width: 1024px) 40vw, 90vw",
  priority,
  className,
}: {
  slot: SlotId;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const spec = SLOTS[slot];
  const photo = slotPhoto(slot);
  const showBrief = slotBriefsVisible();
  return (
    <div
      className={cn("bg-surface-muted relative w-full overflow-hidden", className)}
      style={{ aspectRatio: slotAspect(slot) }}
      data-slot={slot}
      data-slot-state={photo ? "photo" : "illustration"}
    >
      {photo ? (
        <Image src={photo} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <Image
          src={`/illustrations/${spec.fallback}.svg`}
          alt={alt}
          fill
          unoptimized
          priority={priority}
          className="object-cover"
        />
      )}
      {showBrief ? (
        <p className="border-on-accent/40 text-on-accent absolute inset-x-1.5 bottom-1.5 line-clamp-4 rounded-sm border border-dashed bg-white/95 p-1.5 text-[10px] leading-snug">
          <span className="font-semibold">
            {slot} · {spec.aspect}
          </span>{" "}
          — {spec.brief}
        </p>
      ) : null}
    </div>
  );
}
