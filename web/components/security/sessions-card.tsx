"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HelpCircle, LogOut, Monitor, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useRevokeOtherSessions, useRevokeSession, useSessions } from "@/lib/api/hooks/security";
import type { SessionDevice } from "@/lib/api/types-security";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { describeUserAgent } from "./helpers";

const PLATFORM_ICON = { web: Monitor, android: Smartphone, ios: Smartphone, other: HelpCircle } as const;

function sortSessions(list: SessionDevice[]): SessionDevice[] {
  return [...list].sort((a, b) =>
    a.current !== b.current ? (a.current ? -1 : 1) : b.last_seen_at.localeCompare(a.last_seen_at),
  );
}

/** Signed-in devices with per-device revoke and "sign out other devices". */
export function SessionsCard() {
  const t = useTranslations("security.sessions");
  const tc = useTranslations();
  const query = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [target, setTarget] = React.useState<SessionDevice | null>(null);
  const [othersOpen, setOthersOpen] = React.useState(false);
  const sessions = sortSessions(query.data ?? []);
  const others = sessions.filter((s) => !s.current).length;

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("description")}
        action={
          others > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => setOthersOpen(true)}>
              <LogOut aria-hidden />
              {t("revoke_others")}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {query.isLoading ? (
          <div className="space-y-3" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-dense border border-border">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onRevoke={() => setTarget(s)} />
            ))}
          </ul>
        )}
      </CardBody>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t("revoke_title")}
        description={t("revoke_body")}
        confirmLabel={t("revoke")}
        danger
        loading={revoke.isPending}
        onConfirm={() =>
          target &&
          revoke.mutate(target.id, {
            onSuccess: () => {
              toast.success(t("revoked_toast"));
              setTarget(null);
            },
            onError: (e) => toastError(e, tc),
          })
        }
      />
      <ConfirmDialog
        open={othersOpen}
        onOpenChange={setOthersOpen}
        title={t("revoke_others_title")}
        description={t("revoke_others_body")}
        confirmLabel={t("revoke_others")}
        danger
        loading={revokeOthers.isPending}
        onConfirm={() =>
          revokeOthers.mutate(undefined, {
            onSuccess: (res) => {
              toast.success(t("revoked_others_toast", { count: res?.revoked ?? others }));
              setOthersOpen(false);
            },
            onError: (e) => toastError(e, tc),
          })
        }
      />
    </Card>
  );
}

function SessionRow({ session: s, onRevoke }: { session: SessionDevice; onRevoke: () => void }) {
  const t = useTranslations("security.sessions");
  const f = useFormat();
  const Icon = PLATFORM_ICON[s.platform] ?? HelpCircle;
  const { browser, os } = describeUserAgent(s.user_agent);
  const platform = t(`platform.${s.platform in PLATFORM_ICON ? s.platform : "other"}`);
  const name =
    browser && os ? t("device_on", { browser, os }) : (browser ?? os ?? platform);
  return (
    <li className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-fg-muted">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
            <span className="truncate" title={s.user_agent || undefined}>
              {name}
            </span>
            {s.current ? <Badge tone="success">{t("this_device")}</Badge> : null}
          </p>
          <p className="text-xs text-fg-muted">
            {[platform, s.ip ? f.digits(s.ip) : null].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-fg-muted">
            {t("last_active", { date: f.dateTime(s.last_seen_at) })} ·{" "}
            {t("signed_in", { date: f.dateTime(s.created_at) })}
          </p>
        </div>
      </div>
      {!s.current ? (
        <Button variant="danger-outline" size="sm" onClick={onRevoke} className="self-start sm:self-center">
          <LogOut aria-hidden />
          {t("revoke")}
        </Button>
      ) : null}
    </li>
  );
}
