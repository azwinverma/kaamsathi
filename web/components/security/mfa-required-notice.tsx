"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOptionalSession } from "@/components/providers/session";
import { qk } from "@/lib/api/keys";
import { isMfaRequiredError, needsMfaEnrolment } from "./helpers";
import { Notice } from "./notice";

const ACCOUNT_PATH = "/ops/account";

/** "Two-step verification is required" — points staff to /ops/account to enrol. */
export function MfaRequiredNotice({ showAction = true, className }: { showAction?: boolean; className?: string }) {
  const t = useTranslations("security.mfa_required");
  return (
    <Notice
      tone="warning"
      role="alert"
      title={t("title")}
      className={className}
      action={
        showAction ? (
          <Button asChild size="sm">
            <Link href={ACCOUNT_PATH}>
              <LockKeyhole aria-hidden />
              {t("action")}
            </Link>
          </Button>
        ) : null
      }
    >
      {t("body")}
    </Notice>
  );
}

/**
 * Ops-wide hook-in: while a staff member must enrol MFA, every /ops/* API call returns
 * 403 `mfa_required`. Instead of a page of errors we show one clear notice (except on the
 * account page, where enrolment happens). Also reacts to a live `mfa_required` 403 when
 * `/auth/me` is stale.
 */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const session = useOptionalSession();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [seen403, setSeen403] = React.useState(false);

  React.useEffect(() => {
    const cache = qc.getQueryCache();
    return cache.subscribe((event) => {
      if (event.type === "updated" && isMfaRequiredError(event.query.state.error)) {
        setSeen403(true);
        void qc.invalidateQueries({ queryKey: qk.me });
      }
    });
  }, [qc]);

  const required = needsMfaEnrolment(session?.me) || (seen403 && session?.me.mfa_enabled !== true);
  if (!required || pathname === ACCOUNT_PATH || pathname.startsWith(`${ACCOUNT_PATH}/`)) {
    return <>{children}</>;
  }
  return (
    <div className="mx-auto max-w-2xl py-8">
      <MfaRequiredNotice />
    </div>
  );
}
