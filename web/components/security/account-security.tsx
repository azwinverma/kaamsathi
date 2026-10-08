"use client";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/page-header";
import { MfaCard } from "./mfa-card";
import { SessionsCard } from "./sessions-card";

/** /app/account and /ops/account: two-step verification + signed-in devices. */
export function AccountSecurity() {
  const t = useTranslations("security.account");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="space-y-6">
        <MfaCard />
        <SessionsCard />
      </div>
    </div>
  );
}
