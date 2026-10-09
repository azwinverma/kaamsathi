"use client";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import type { BookingEvent, BookingStatus } from "@/lib/api/types-bolau";
import { bookingTimeline } from "@/lib/bolau/timeline";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/**
 * Booking progress: requested → accepted → on the way → arrived → working → completed → confirmed.
 * Done steps are filled teal with their time; the current step has a yellow ring; future steps are
 * dashed (the next step, not a failure); a stopped booking says where and why it stopped.
 */
export function StatusTimeline({ status, events }: { status: BookingStatus; events?: BookingEvent[] }) {
  const t = useTranslations("bolau");
  const f = useFormat();
  const { steps, stoppedAt } = bookingTimeline(status, events ?? []);
  return (
    <div>
      <ol aria-label={t("timeline.label")} className="relative space-y-0">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={s.status} className="relative flex gap-3 pb-5 last:pb-0" aria-current={s.state === "current" ? "step" : undefined}>
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-7 bottom-0 left-[13px] w-0.5",
                    s.state === "done" ? "bg-teal" : "bg-border-strong",
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
                  s.state === "done" && "bg-teal text-on-accent",
                  s.state === "current" && "bg-surface ring-yellow ring-4 ring-offset-0",
                  s.state === "todo" && "border-border-strong bg-surface border-2 border-dashed",
                  s.state === "skipped" && "bg-surface-muted text-fg-subtle",
                )}
              >
                {s.state === "done" ? <Check className="size-4" strokeWidth={3} /> : null}
                {s.state === "current" ? <span className="bg-fg size-2.5 rounded-full" /> : null}
                {s.state === "skipped" ? <X className="size-3.5" /> : null}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={cn(
                    "text-sm leading-tight",
                    s.state === "current" ? "text-fg font-bold" : s.state === "done" ? "text-fg font-semibold" : "text-fg-muted",
                    s.state === "skipped" && "line-through",
                  )}
                >
                  {t(`status.${s.status}`)}
                  {s.state === "current" ? (
                    <span className="bg-yellow text-on-accent ml-2 rounded-pill px-2 py-0.5 text-[11px] font-bold no-underline">
                      {t("timeline.now")}
                    </span>
                  ) : null}
                  {s.state === "skipped" ? <span className="sr-only"> — {t("timeline.skipped")}</span> : null}
                </p>
                {s.at && s.state !== "skipped" ? (
                  <p className="text-fg-muted mt-0.5 text-xs tabular">{f.dateTime(s.at)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {stoppedAt ? (
        <p className="border-coral bg-coral-subtle text-fg mt-4 rounded-dense border-l-4 px-3 py-2 text-sm font-semibold">
          {t("timeline.stopped", { status: t(`status.${stoppedAt}`) })}
        </p>
      ) : null}
    </div>
  );
}
