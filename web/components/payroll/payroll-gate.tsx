"use client";
import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/feedback";
import { useSession } from "@/components/providers/session";
import { downloadFile } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";

/** Payroll is owner/admin/hr only (CONTRACT §1 roles). */
export function PayrollGate({ children }: { children: React.ReactNode }) {
  const { canManage } = useSession();
  const t = useTranslations();
  if (!canManage) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title={t("errors.forbidden_title")}
        description={t("payroll_page.forbidden")}
        className="mx-auto mt-8 max-w-xl"
      />
    );
  }
  return <>{children}</>;
}

/** Authenticated file download via the BFF proxy, with per-file pending state. */
export function useDownloader() {
  const t = useTranslations();
  const [pending, setPending] = React.useState<string | null>(null);
  const download = React.useCallback(
    async (path: string, fallbackName: string) => {
      setPending(path);
      try {
        await downloadFile(path, fallbackName);
      } catch (err) {
        const detail = isApiError(err) && err.message ? err.message : t("errors.server_error");
        toast.error(t("payroll_page.actions.download_failed"), { description: detail });
      } finally {
        setPending(null);
      }
    },
    [t],
  );
  return { download, pending };
}
