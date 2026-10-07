"use client";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

/** In-shell "no access" panel for role-gated pages. */
export function NoAccess({ description }: { description?: string }) {
  const t = useTranslations();
  return (
    <EmptyState
      icon={Lock}
      title={t("errors.forbidden_title")}
      description={description ?? t("errors.forbidden_body")}
      action={
        <Button asChild variant="secondary">
          <Link href="/app">{t("nav.dashboard")}</Link>
        </Button>
      }
      className="mt-6"
    />
  );
}
