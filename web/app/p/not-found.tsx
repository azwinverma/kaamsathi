import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldQuestion } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle } from "@/components/providers/preferences";
import { buttonVariants } from "@/components/ui/button";

/** Graceful 404 for /p/* — same message whether the passport is private, expired or unknown. */
export default async function PassportNotFound() {
  const t = await getTranslations("credentials.passport");
  const tApp = await getTranslations("app");
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <header className="border-border bg-surface border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Logo name={tApp("name")} />
          <div className="ml-auto">
            <LanguageToggle compact />
          </div>
        </div>
      </header>
      <main
        id="main"
        className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center"
      >
        <span className="bg-surface-muted text-fg-muted flex size-14 items-center justify-center rounded-full">
          <ShieldQuestion className="size-7" aria-hidden />
        </span>
        <h1 className="text-fg mt-5 text-2xl font-semibold">{t("not_found_title")}</h1>
        <p className="text-fg-muted mt-2">{t("not_found_body")}</p>
        <p className="text-fg-muted mt-1 text-sm">{t("not_found_hint")}</p>
        <Link href="/" className={buttonVariants({ variant: "secondary", className: "mt-6" })}>
          {t("home")}
        </Link>
      </main>
    </div>
  );
}
