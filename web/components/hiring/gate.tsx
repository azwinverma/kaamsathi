"use client";
import * as React from "react";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/components/providers/session";
import { EmptyState } from "@/components/ui/feedback";

/** Hiring is owner/admin/hr only (CONTRACT §1 roles). Supervisors see a no-access state. */
export function HiringGate({ children }: { children: React.ReactNode }) {
  const { canManage } = useSession();
  const t = useTranslations("errors");
  if (!canManage) {
    return (
      <EmptyState icon={Lock} title={t("forbidden_title")} description={t("forbidden_body")} />
    );
  }
  return <>{children}</>;
}
