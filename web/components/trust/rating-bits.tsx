"use client";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RatingEntry } from "@/lib/api/types-moderation";
import { useFormat } from "@/lib/use-format";
import { COMMENT_STATUS_TONE } from "./moderation";

export function CommentStatusBadge({ rating }: { rating: Pick<RatingEntry, "comment_status" | "comment_status_label"> }) {
  const tr = useTranslations("moderation.comment_status");
  return (
    <Badge tone={COMMENT_STATUS_TONE[rating.comment_status] ?? "neutral"} dot>
      {rating.comment_status_label || tr(rating.comment_status)}
    </Badge>
  );
}

/** score_a / score_b with labels that depend on who rated whom. */
export function ScorePair({ rating }: { rating: Pick<RatingEntry, "rater" | "score_a" | "score_b"> }) {
  const ts = useTranslations("moderation.scores");
  const f = useFormat();
  const rows = [
    { label: ts(`${rating.rater}_a`), value: rating.score_a },
    { label: ts(`${rating.rater}_b`), value: rating.score_b },
  ];
  return (
    <dl className="space-y-0.5 text-xs">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <dt className="text-fg-muted">{r.label}</dt>
          <dd className="inline-flex items-center gap-0.5 font-medium text-fg tabular">
            <Star className="size-3.5 fill-warning text-warning" aria-hidden />
            {ts("out_of_five", { score: f.digits(r.value) })}
          </dd>
        </div>
      ))}
    </dl>
  );
}
