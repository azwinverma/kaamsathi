"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Settings2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/feedback";
import {
  type InboxNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/lib/api/hooks/notifications";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { PreferencesDialog } from "./preferences-dialog";

/** Header bell: unread badge (polled), dropdown inbox, mark read, settings. */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const f = useFormat();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const unread = useUnreadNotificationCount();
  const list = useNotifications(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = unread.data?.count ?? 0;
  const items = list.data?.results ?? [];

  const pick = (n: InboxNotification) => {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link && n.link.startsWith("/")) {
      setOpen(false);
      router.push(n.link);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg"
            aria-label={count ? t("bell_unread", { count }) : t("bell")}
          >
            <Bell className="size-5" aria-hidden />
            {count > 0 ? (
              <span
                className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-semibold text-white tabular"
                aria-hidden
              >
                {count > 99 ? "99+" : f.digits(count)}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-fg">{t("title")}</p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => markAll.mutate()}
                disabled={count === 0 || markAll.isPending}
              >
                <CheckCheck aria-hidden />
                {t("mark_all")}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("settings")}
                onClick={() => {
                  setOpen(false);
                  setPrefsOpen(true);
                }}
              >
                <Settings2 aria-hidden />
              </Button>
            </div>
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {list.isLoading ? (
              <div className="space-y-2 p-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : list.error ? (
              <p className="p-4 text-sm text-danger">{t("error")}</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-fg-muted">{t("empty")}</p>
            ) : (
              <ul role="list">
                {items.map((n) => (
                  <NotificationItem key={n.id} n={n} onPick={() => pick(n)} />
                ))}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <PreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </>
  );
}

function NotificationItem({ n, onPick }: { n: InboxNotification; onPick: () => void }) {
  const t = useTranslations("notifications");
  const f = useFormat();
  const title = f.locale === "ne" ? n.title_ne || n.title : n.title;
  const body = f.locale === "ne" ? n.body_ne || n.body : n.body;
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover",
          !n.read_at && "bg-brand-subtle/40",
        )}
      >
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-brand")}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-fg">
            {title}
            {!n.read_at ? <span className="sr-only"> ({t("unread")})</span> : null}
          </span>
          {body ? <span className="mt-0.5 line-clamp-2 block text-xs text-fg-muted">{body}</span> : null}
          <span className="mt-1 block text-[11px] text-fg-subtle">{f.dateTime(n.created_at)}</span>
        </span>
      </button>
    </li>
  );
}
