import { getTranslations } from "next-intl/server";
import { BadgeCheck, CalendarCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";
import { BrushStroke } from "@/components/signature/brush-stroke";
import { CutPaperFrame } from "@/components/signature/cut-paper-frame";
import { DotTexture } from "@/components/signature/dot-texture";
import { ImageSlot, slotPhoto } from "@/components/signature/image-slot";
import { MuralLettering } from "@/components/signature/mural-lettering";
import { cn } from "@/lib/utils";

/** Split auth layout: calm form on the left, mural brand panel on the right (desktop). */
export async function AuthFrame({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  const points = [
    { icon: BadgeCheck, title: t("auth.point_verified"), body: t("auth.point_verified_body") },
    { icon: CalendarCheck, title: t("auth.point_hajiri"), body: t("auth.point_hajiri_body") },
    { icon: Wallet, title: t("auth.point_talab"), body: t("auth.point_talab_body") },
  ];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Logo name={t("app.name")} />
          <div className="flex items-center gap-1.5">
            <LanguageToggle compact />
            <ThemeToggle />
          </div>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="text-xs text-fg-subtle">© KaamSathi · {t("auth.footer_place")}</footer>
      </div>
      {/* Mural panel (B · street mural); the form side stays calm. Decorative duplicate of the
          value points, hidden from assistive tech like before. */}
      <aside className="bg-hero text-hero-fg relative isolate hidden overflow-hidden lg:block" aria-hidden>
        <span className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
        <DotTexture className="-z-10" />
        <div className="relative flex h-full flex-col justify-center gap-9 p-12 xl:p-14">
          <div className="flex items-end gap-2">
            <MuralLettering word="साथी" size="md" rotate={-4} />
            <BrushStroke variant="swoosh" tone="teal" className="mb-3 h-12 w-24" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
            <div className="space-y-3">
              <p className="text-hero-fg text-sm font-semibold">{t("marketing.auth.kicker")}</p>
              <h2 className="text-hero-fg max-w-md text-4xl font-extrabold">{t("auth.panel_title")}</h2>
              <p className="max-w-md text-base text-white/90">{t("auth.panel_body")}</p>
            </div>
            <CutPaperFrame
              caption={t("marketing.slots.auth-solar-roof.caption")}
              tag={slotPhoto("auth-solar-roof") ? undefined : t("marketing.illustration")}
              tape="yellow"
              rotate={5}
              className="mr-4 hidden w-44 xl:block"
            >
              <ImageSlot slot="auth-solar-roof" alt={t("marketing.slots.auth-solar-roof.alt")} sizes="176px" />
            </CutPaperFrame>
          </div>
          <ul className="max-w-md space-y-5">
            {points.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-4">
                <span
                  className={cn(
                    "text-on-accent flex size-10 shrink-0 items-center justify-center rounded-dense",
                    ["bg-yellow", "bg-teal", "bg-coral"][i],
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="text-hero-fg block font-semibold">{title}</span>
                  <span className="block text-sm text-white/90">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
