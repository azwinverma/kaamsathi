import { getTranslations } from "next-intl/server";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Code = "P" | "A" | "H" | "L" | "O";

/** Status is never colour-only: every cell shows a letter, and screen readers get the full word. */
const CELL: Record<Code, string> = {
  P: "bg-success-soft text-success",
  A: "bg-danger-soft text-danger",
  H: "bg-warning-soft text-warning",
  L: "bg-info-soft text-info",
  O: "bg-surface-muted text-fg-muted",
};

/**
 * Site roster strip — a real interface fragment (week of hajiri for one site) rendered with demo
 * data on the public home page. Dense and calm, like the employer app it comes from.
 */
export async function RosterStrip({ className }: { className?: string }) {
  const t = await getTranslations("marketing.demo.roster");
  const days = t.raw("days") as string[];
  const rows = t.raw("rows") as { name: string; role: string; cells: Code[] }[];
  const codes: Code[] = ["P", "A", "H", "L", "O"];
  return (
    <figure
      className={cn("border-border bg-surface m-0 rounded-dense border shadow-sm", className)}
      aria-labelledby="roster-title"
    >
      <figcaption className="border-border flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-3">
        <span id="roster-title" className="text-fg text-sm font-semibold">
          {t("title")}
        </span>
        <span className="text-fg-muted text-xs">{t("week")}</span>
      </figcaption>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[19rem] border-collapse text-sm">
          <thead>
            <tr className="text-fg-muted text-xs">
              <th scope="col" className="px-3 py-2 text-left font-medium sm:px-4">
                {t("worker")}
              </th>
              {days.map((d) => (
                <th key={d} scope="col" className="px-0.5 py-2 text-center font-medium">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-border border-t">
                <th scope="row" className="px-3 py-2 text-left font-normal sm:px-4">
                  <span className="text-fg block text-[13px] leading-tight font-semibold sm:text-sm">{r.name}</span>
                  <span className="text-fg-muted block text-xs leading-tight">{r.role}</span>
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-0.5 py-2 text-center last:pr-2 sm:last:pr-3">
                    <span
                      className={cn(
                        "tabular mx-auto flex size-7 items-center justify-center rounded-sm text-xs font-bold sm:size-8",
                        CELL[c],
                      )}
                    >
                      <span aria-hidden>{t(`codes.${c}`)}</span>
                      <span className="sr-only">{t(`legend.${c}`)}</span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-border text-fg-muted flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-hidden>
          {codes.map((c) => (
            <li key={c} className="inline-flex items-center gap-1.5">
              <span className={cn("tabular inline-flex size-5 items-center justify-center rounded-[4px] text-[11px] font-bold", CELL[c])}>
                {t(`codes.${c}`)}
              </span>
              {t(`legend.${c}`)}
            </li>
          ))}
        </ul>
        <p className="inline-flex items-center gap-1.5">
          <CloudOff className="size-3.5" aria-hidden />
          {t("offline")}
        </p>
      </div>
    </figure>
  );
}
