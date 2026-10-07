import { getTranslations } from "next-intl/server";
import { BadgeCheck, CalendarCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";

/** Split auth layout: form on the left, brand panel on the right (desktop). */
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
      <aside className="relative hidden overflow-hidden bg-primary-900 lg:block" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 20%, black 20%, transparent 75%)",
          }}
        />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary-600/40 blur-3xl" />
        <div className="absolute bottom-10 left-10 size-40 rounded-full bg-accent-500/25 blur-3xl" />
        <div className="relative flex h-full flex-col justify-center gap-10 p-14 text-white">
          <div className="space-y-3">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-primary-100 ring-1 ring-white/15">
              <span className="size-1.5 rounded-full bg-accent-500" />
              {t("app.tagline")}
            </p>
            <h2 className="max-w-md text-4xl font-semibold text-white">{t("auth.panel_title")}</h2>
            <p className="max-w-md text-base text-primary-100/80">{t("auth.panel_body")}</p>
          </div>
          <ul className="max-w-md space-y-5">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5 text-white" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{title}</span>
                  <span className="block text-sm text-primary-100/75">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
