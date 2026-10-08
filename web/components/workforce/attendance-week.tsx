"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { SiteRosterStrip, type RosterCell, type RosterTone } from "@/components/ledger";
import { Skeleton } from "@/components/ui/feedback";
import { useSites } from "@/lib/api/hooks/org";
import { useAttendanceRegister } from "@/lib/api/hooks/workforce";
import { listResults } from "@/lib/api/client";
import { todayBs, todayIso } from "@/lib/format";
import { useFormat } from "@/lib/use-format";
import type { RegisterCell } from "@/lib/api/types";
import { CODE_LABEL_KEY } from "./utils";

const CELL: Record<Exclude<RegisterCell, null>, { code: string; tone: RosterTone } | null> = {
  P: { code: "P", tone: "success" },
  H: { code: "½", tone: "warning" },
  A: { code: "A", tone: "danger" },
  L: { code: "L", tone: "info" },
  PH: { code: "PH", tone: "neutral" },
  WO: null,
};

/**
 * "This week" site roster strip for the hajiri page: the last seven days of the current BS month
 * from the attendance register, one row per worker (first site when the org has one, else all).
 */
export function AttendanceWeek({ site, moreHref }: { site?: string; moreHref?: string }) {
  const ta = useTranslations("workforce.attendance");
  const tr = useTranslations("ledger.roster");
  const f = useFormat();
  const now = React.useMemo(() => todayBs(), []);
  const today = todayIso();
  const sites = listResults(useSites().data);
  const q = useAttendanceRegister(now.year, now.month, site || undefined);
  const siteName = site ? (sites.find((s) => s.id === site)?.name ?? tr("all_sites")) : tr("all_sites");

  if (q.isLoading) return <Skeleton className="h-48 rounded-dense" />;
  if (q.isError || !q.data) return null;

  const days = q.data.days.filter((d) => d.date <= today).slice(-7);
  const legend = (["P", "H", "A", "L"] as const).map((c) => ({
    code: CELL[c]!.code,
    tone: CELL[c]!.tone,
    label: ta(CODE_LABEL_KEY[c]),
  }));
  return (
    <section aria-labelledby="week-roster-heading" className="space-y-2">
      <h2 id="week-roster-heading" className="text-[17px] font-semibold">
        {tr("this_week")}
      </h2>
      <SiteRosterStrip
        site={siteName}
        maxRows={10}
        moreHref={moreHref}
        legend={legend}
        days={days.map((d) => ({
          date: d.date,
          label: `${f.weekday(d.weekday)} ${f.digits(d.bs_day)}`,
          off: d.is_weekly_off || d.is_holiday,
          today: d.date === today,
        }))}
        rows={q.data.rows.map((r) => ({
          id: r.employment_id,
          name: r.worker_name,
          meta: r.designation || undefined,
          href: `/app/workers/${r.employment_id}`,
          cells: Object.fromEntries(
            days.map((d) => {
              const code = r.cells[d.date];
              const spec = code ? CELL[code] : null;
              const cell: RosterCell | null = spec && code ? { ...spec, label: ta(CODE_LABEL_KEY[code]) } : null;
              return [d.date, cell];
            }),
          ),
        }))}
      />
    </section>
  );
}
