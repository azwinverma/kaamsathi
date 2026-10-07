"use client";
import * as React from "react";
import { FileSpreadsheet } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/feedback";
import { RowHeader, TBody, TFoot, THead, Table, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Payslip } from "@/lib/api/types";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { sumBy } from "./utils";

type Kind = "days" | "hours" | "money";
type Group = "days" | "earnings" | "deductions";

interface Col {
  key: keyof Payslip;
  label: string;
  kind: Kind;
  group: Group;
  strong?: boolean;
}

const COLS: Omit<Col, "label">[] = [
  { key: "present_days", kind: "days", group: "days" },
  { key: "paid_leave_days", kind: "days", group: "days" },
  { key: "holiday_days", kind: "days", group: "days" },
  { key: "weekly_off_days", kind: "days", group: "days" },
  { key: "absent_days", kind: "days", group: "days" },
  { key: "payable_days", kind: "days", group: "days", strong: true },
  { key: "overtime_hours", kind: "hours", group: "days" },
  { key: "basic_earned", kind: "money", group: "earnings" },
  { key: "da_earned", kind: "money", group: "earnings" },
  { key: "allowance_earned", kind: "money", group: "earnings" },
  { key: "overtime_pay", kind: "money", group: "earnings" },
  { key: "festival_allowance", kind: "money", group: "earnings" },
  { key: "gross_pay", kind: "money", group: "earnings", strong: true },
  { key: "ssf_employee", kind: "money", group: "deductions" },
  { key: "tds", kind: "money", group: "deductions" },
  { key: "advance_recovery", kind: "money", group: "deductions" },
  { key: "other_deductions", kind: "money", group: "deductions" },
  { key: "net_pay", kind: "money", group: "deductions", strong: true },
];

const LABEL_KEY: Partial<Record<keyof Payslip, string>> = {
  present_days: "col_present",
  paid_leave_days: "col_leave",
  holiday_days: "col_holiday",
  weekly_off_days: "col_weekly_off",
  absent_days: "col_absent",
  payable_days: "col_payable",
  overtime_hours: "col_ot_hours",
  basic_earned: "col_basic",
  da_earned: "col_da",
  allowance_earned: "col_allowance",
  overtime_pay: "col_ot_pay",
  festival_allowance: "col_festival",
  gross_pay: "col_gross",
  ssf_employee: "col_ssf",
  tds: "col_tds",
  advance_recovery: "col_advance",
  other_deductions: "col_other",
  net_pay: "col_net",
};

/** First column of each group gets a divider so Days / Earnings / Deductions read as blocks. */
const GROUP_START = new Set<keyof Payslip>(["present_days", "basic_earned", "ssf_employee"]);

/** तलब पाना — wide table, scrolls inside its container with the worker column pinned. */
export function WageSheet({
  rows,
  isLoading,
  error,
  onRetry,
  query,
  onOpen,
  selectedId,
}: {
  rows: Payslip[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  query: string;
  onOpen: (p: Payslip) => void;
  selectedId?: string | null;
}) {
  const t = useTranslations("payroll_page.sheet");
  const f = useFormat();
  const cols: Col[] = COLS.map((c) => ({ ...c, label: t(LABEL_KEY[c.key]!) }));

  if (isLoading) return <TableSkeleton rows={8} cols={8} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title={query ? t("no_match", { q: query }) : t("empty")}
      />
    );
  }

  const fmt = (v: unknown, kind: Kind) =>
    kind === "money" ? f.money(v as string) : f.number(v as string, { fallback: "0" });

  const groupSpan = (g: Group) => cols.filter((c) => c.group === g).length;

  return (
    <>
      <p className="mb-2 text-xs text-fg-muted lg:hidden">{t("scroll_hint")}</p>
      <TableContainer maxHeight="min(70vh, 900px)">
        <Table className="min-w-max">
          <THead>
            <tr>
              <Th sticky rowSpan={2} className="h-auto border-r align-bottom">
                {t("col_worker")}
              </Th>
              <Th colSpan={groupSpan("days")} className="h-8 border-l text-center">
                {t("group_days")}
              </Th>
              <Th colSpan={groupSpan("earnings")} className="h-8 border-l text-center">
                {t("group_earnings")}
              </Th>
              <Th colSpan={groupSpan("deductions")} className="h-8 border-l text-center">
                {t("group_deductions")}
              </Th>
              <Th rowSpan={2} className="h-auto border-l align-bottom">
                {t("col_payment")}
              </Th>
            </tr>
            <tr>
              {cols.map((c) => (
                <Th
                  key={c.key}
                  numeric
                  className={cn("h-9", GROUP_START.has(c.key) && "border-l", c.strong && "text-fg")}
                >
                  {c.label}
                </Th>
              ))}
            </tr>
          </THead>
          <TBody>
            {rows.map((p) => (
              <Tr
                key={p.id}
                interactive
                selected={selectedId === p.id}
                onClick={() => onOpen(p)}
              >
                <RowHeader sticky className="max-w-56 min-w-44 border-r">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(p);
                    }}
                    className="block max-w-full truncate text-left font-medium text-fg hover:text-brand hover:underline"
                    aria-label={t("open_payslip", { name: p.worker.full_name })}
                  >
                    {p.worker.full_name}
                  </button>
                  {p.designation ? (
                    <span className="block truncate text-xs font-normal text-fg-muted">{p.designation}</span>
                  ) : null}
                </RowHeader>
                {cols.map((c) => (
                  <Td
                    key={c.key}
                    numeric
                    className={cn(
                      GROUP_START.has(c.key) && "border-l",
                      c.strong ? "font-semibold text-fg" : "",
                      c.key === "absent_days" && Number(p.absent_days) > 0 && "text-danger",
                    )}
                  >
                    {fmt(p[c.key], c.kind)}
                  </Td>
                ))}
                <Td className="border-l">
                  <StatusBadge status={p.payment_status} />
                </Td>
              </Tr>
            ))}
          </TBody>
          <TFoot>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-20 h-11 border-r px-4 text-left text-sm whitespace-nowrap"
              >
                {t("totals_row", { count: f.number(rows.length) })}
              </th>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "h-11 px-4 text-right whitespace-nowrap tabular",
                    GROUP_START.has(c.key) && "border-l",
                  )}
                >
                  {fmt(sumBy(rows, c.key), c.kind)}
                </td>
              ))}
              <td className="border-l" />
            </tr>
          </TFoot>
        </Table>
      </TableContainer>
    </>
  );
}
