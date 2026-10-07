"use client";
import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button, buttonVariants } from "@/components/ui/button";

/** Route-level error boundary (inside the root layout, so i18n providers are available). */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("legal.error");
  const tApp = useTranslations("app");

  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-bg flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo name={tApp("name")} />
      <div role="alert" className="flex max-w-md flex-col items-center">
        <span className="bg-danger-subtle text-danger flex size-14 items-center justify-center rounded-full">
          <AlertTriangle className="size-7" aria-hidden />
        </span>
        <h1 className="text-fg mt-5 text-2xl font-semibold">{t("error_title")}</h1>
        <p className="text-fg-muted mt-2">{t("error_body")}</p>
        {error.digest ? (
          <p className="text-fg-subtle tabular mt-2 text-xs">
            {t("reference", { digest: error.digest })}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => reset()}>
            <RotateCcw aria-hidden />
            {t("retry")}
          </Button>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            {t("go_home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
