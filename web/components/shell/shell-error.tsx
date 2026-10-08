"use client";
import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/ui/feedback";
import { Logo } from "@/components/brand";

export function ShellError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <Logo href="/" name={t("app.name")} />
      <ErrorState error={error} onRetry={retry} className="w-full max-w-md" />
    </div>
  );
}

export function Forbidden() {
  const t = useTranslations();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo href="/" name={t("app.name")} />
      <h1 className="text-xl font-semibold">{t("errors.forbidden_title")}</h1>
      <p className="max-w-sm text-sm text-fg-muted">{t("errors.forbidden_body")}</p>
      <a href="/app" className="text-sm font-medium text-brand-text hover:underline">
        {t("nav.employer_portal")}
      </a>
    </div>
  );
}
