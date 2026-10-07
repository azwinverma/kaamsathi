"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormat } from "@/lib/use-format";
import { Button } from "./button";

export function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("common");
  const f = useFormat();
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(count, page * pageSize);
  return (
    <nav className="mt-4 flex items-center justify-between gap-4" aria-label="Pagination">
      <p className="text-sm text-fg-muted tabular">
        {t("showing", { from: f.digits(from), to: f.digits(to), total: f.digits(count) })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft aria-hidden />
          {t("previous")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          {t("next")}
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
