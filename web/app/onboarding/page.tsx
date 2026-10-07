import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("meta_title") };
}

export default async function OnboardingPage() {
  const t = await getTranslations();
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo name={t("app.name")} />
          <div className="flex items-center gap-1.5">
            <LanguageToggle compact />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <OnboardingForm />
      </main>
    </div>
  );
}
