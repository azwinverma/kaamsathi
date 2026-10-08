"use client";
import { useTranslations } from "next-intl";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";
import { useSession } from "@/components/providers/session";
import type { StaffRole } from "@/lib/api/types-security";
import { hasStaffRole } from "./helpers";

/** Friendly "not for your role" state; the backend enforces the same rule. */
export function RequireStaffRole({ roles, children }: { roles: StaffRole[]; children: React.ReactNode }) {
  const t = useTranslations("security.role_guard");
  const { me } = useSession();
  if (!hasStaffRole(me, roles)) {
    return <EmptyState icon={ShieldAlert} title={t("title")} description={t("body")} />;
  }
  return <>{children}</>;
}
