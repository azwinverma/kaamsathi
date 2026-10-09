import {
  AirVent,
  BrickWall,
  CookingPot,
  Droplets,
  Hammer,
  PaintRoller,
  PlugZap,
  Scissors,
  Shirt,
  SprayCan,
  SunMedium,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** One plain line icon per trade (no coloured circles), so a chip reads at a glance. */
const ICONS: Record<string, LucideIcon> = {
  electrician: PlugZap,
  plumber: Droplets,
  cook: CookingPot,
  kitchen_helper: CookingPot,
  cleaner: SprayCan,
  housekeeping: Shirt,
  hvac_technician: AirVent,
  solar_technician: SunMedium,
  painter: PaintRoller,
  carpenter: Hammer,
  mason: BrickWall,
  tailor: Scissors,
};

export function tradeIcon(code: string | null | undefined): LucideIcon {
  return (code && ICONS[code]) || Wrench;
}

export function TradeIcon({ code, className }: { code: string | null | undefined; className?: string }) {
  const Icon = tradeIcon(code);
  return <Icon className={className} aria-hidden />;
}
