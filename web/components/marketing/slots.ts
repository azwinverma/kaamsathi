/**
 * Art-directed image slots for the public website, Passport and auth frame.
 *
 * Every photo position on the public surfaces is one of these ids. Until a commissioned photo exists
 * at `web/public/images/photos/<id>.webp` (or `.jpg`), `<ImageSlot>` renders the illustrated fallback
 * from the kit in `design/illustrations/` (copied to `web/public/illustrations/`).
 *
 * The shot list for the photographer lives in `docs/design/PHOTOGRAPHY_BRIEF.md` and uses the same ids
 * (a unit test keeps the two in sync). `brief` is internal art direction, shown on the page only in
 * development or with `?slots=1`; the visitor-facing alt text and captions live in messages under
 * `marketing.slots.<id>`.
 */

export type SlotAspect = "4/5" | "4/3" | "3/2" | "1/1";

export interface SlotSpec {
  /** Aspect ratio the photo must be cropped to (width / height). */
  aspect: SlotAspect;
  /** Illustration file name (without .svg) in /illustrations used until the photo exists. */
  fallback: string;
  /** Shot description for the photographer (English, internal). */
  brief: string;
}

export const SLOTS = {
  "hero-hvac-biratnagar": {
    aspect: "4/5",
    fallback: "hvac-gauge",
    brief:
      "Portrait, HVAC technician at a Biratnagar cold store, own uniform, manifold gauge set in hand, morning light from the loading bay.",
  },
  "hero-electrician-bhaktapur": {
    aspect: "4/5",
    fallback: "electrician-board",
    brief:
      "Portrait, woman electrician at a Bhaktapur housing site, hard hat on, insulated gloves, at an open distribution board. Brick, not temples.",
  },
  "passport-hands-phone": {
    aspect: "4/5",
    fallback: "passport-phone",
    brief:
      "Close-up, a worker's hands holding a budget Android phone showing their Skill Passport. Real hands, real wear; screen added in post from a real build.",
  },
  "mural-wall-patan": {
    aspect: "4/3",
    fallback: "mural-wall",
    brief:
      "The commissioned KaamSathi street mural on a Patan wall: tools, hands and Devanagari lettering. Straight-on, overcast light, people walking past for scale.",
  },
  "career-welder-visor": {
    aspect: "4/3",
    fallback: "welder-visor",
    brief:
      "Candid, woman welder at a CTEVT-affiliated training lab lifting her visor after a test weld. Full PPE, booth curtain behind.",
  },
  "employer-supervisor-hajiri": {
    aspect: "4/3",
    fallback: "supervisor-hajiri",
    brief:
      "Site supervisor (40s–50s) in a white hard hat and hi-vis vest marking hajiri on a phone at a Lalitpur building site, scaffold behind.",
  },
  "worker-cook-kitchen": {
    aspect: "4/5",
    fallback: "cook-kitchen",
    brief:
      "Cook at work in a Thamel hotel kitchen, hair cover and apron, karahi on the burner, pressure cooker beside. Candid, not looking at camera.",
  },
  "worker-guard-gate": {
    aspect: "4/5",
    fallback: "security-gate",
    brief:
      "Woman security guard at a Kathmandu office compound gate, uniform and cap, writing in the visitor register.",
  },
  "partners-training-lab": {
    aspect: "4/3",
    fallback: "training-lab",
    brief:
      "Instructor and trainee at a wiring practice board in a training institute, safety glasses on, natural light.",
  },
  "auth-solar-roof": {
    aspect: "4/5",
    fallback: "solar-roof",
    brief:
      "Solar installer on a tin roof in Pokhara or Butwal, harness clipped to an anchor, helmet with chin strap, fixing a panel.",
  },
  "notfound-plumber": {
    aspect: "4/5",
    fallback: "plumber-wrench",
    brief:
      "Plumber tightening a joint with a pipe wrench under a rooftop water tank. Illustration is fine here long-term; photo optional.",
  },
} as const satisfies Record<string, SlotSpec>;

export type SlotId = keyof typeof SLOTS;

export const SLOT_IDS = Object.keys(SLOTS) as SlotId[];

/** CSS aspect-ratio value for a slot. */
export function slotAspect(id: SlotId): string {
  return SLOTS[id].aspect.replace("/", " / ");
}
