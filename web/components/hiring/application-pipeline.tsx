"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Gauge, Tag, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useSession } from "@/components/providers/session";
import { listResults } from "@/lib/api/client";
import { useMembers } from "@/lib/api/hooks/org";
import { useApplicationTags, useUpdateApplication } from "@/lib/api/hooks/pipeline";
import type { Application } from "@/lib/api/types";
import { MAX_TAGS, MAX_TAG_LENGTH } from "@/lib/api/types-pipeline";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { addTag, normalizeTag } from "./pipeline-lib";

type PipelineApp = Pick<
  Application,
  "id" | "tags" | "assignee" | "match_score" | "match_algorithm_version"
>;

/** "Match 82 · v2.1" (set when ops shortlisted). */
export function MatchScoreBadge({ app, className }: { app: PipelineApp; className?: string }) {
  const t = useTranslations("pipeline.match");
  const f = useFormat();
  if (app.match_score === null || app.match_score === undefined) return null;
  const score = f.digits(app.match_score);
  return (
    <Badge tone="outline" className={className} title={t("hint")}>
      <Gauge aria-hidden />
      {app.match_algorithm_version
        ? t("score_version", { score, version: app.match_algorithm_version })
        : t("score", { score })}
    </Badge>
  );
}

/** Read-only tag chips + assignee (pipeline cards, candidate rows). */
export function TagsAndAssignee({ app, className }: { app: PipelineApp; className?: string }) {
  const t = useTranslations("pipeline.assign");
  const tags = app.tags ?? [];
  if (!tags.length && !app.assignee) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-1", className)}>
      {tags.map((tag) => (
        <Badge key={tag} tone="neutral">
          <Tag aria-hidden />
          {tag}
        </Badge>
      ))}
      {app.assignee ? (
        <Badge tone="outline" title={t("label")}>
          <UserRound aria-hidden />
          <span className="sr-only">{t("label")}: </span>
          {app.assignee.full_name}
        </Badge>
      ) : null}
    </span>
  );
}

/** Drawer section: assignee select + tag editor, each saved via PATCH /org/applications/{id}. */
export function AssignmentSection({ app }: { app: PipelineApp }) {
  return (
    <div className="space-y-4">
      <AssigneeSelect app={app} />
      <TagEditor app={app} />
    </div>
  );
}

function AssigneeSelect({ app }: { app: PipelineApp }) {
  const t = useTranslations();
  const ta = useTranslations("pipeline.assign");
  const { me } = useSession();
  const members = useMembers();
  const update = useUpdateApplication();
  const options = listResults(members.data)
    .filter((m) => m.is_active)
    .map((m) => ({
      value: m.user.id,
      label: m.user.id === me.id ? ta("me_named", { name: m.user.full_name }) : m.user.full_name,
    }));
  // Keep the current assignee selectable even if they are no longer an active member.
  if (app.assignee && !options.some((o) => o.value === app.assignee?.id)) {
    options.push({ value: app.assignee.id, label: app.assignee.full_name });
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`assignee-${app.id}`} className="text-fg text-sm font-medium">
        {ta("label")}
      </label>
      <div className="flex items-center gap-2">
        <Select
          id={`assignee-${app.id}`}
          value={app.assignee?.id ?? ""}
          onValueChange={(v) =>
            update.mutate(
              { id: app.id, assignee_id: v || null },
              {
                onSuccess: () => toast.success(ta("saved_toast")),
                onError: (e) => toastError(e, t),
              },
            )
          }
          allowEmpty
          emptyLabel={ta("unassigned")}
          placeholder={ta("unassigned")}
          disabled={members.isLoading || update.isPending}
          options={options}
          className="sm:w-72"
        />
        {app.assignee?.id !== me.id ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              update.mutate(
                { id: app.id, assignee_id: me.id },
                {
                  onSuccess: () => toast.success(ta("saved_toast")),
                  onError: (e) => toastError(e, t),
                },
              )
            }
            disabled={update.isPending}
          >
            {ta("assign_me")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function TagEditor({ app }: { app: PipelineApp }) {
  const t = useTranslations();
  const tt = useTranslations("pipeline.tags");
  const update = useUpdateApplication();
  const all = useApplicationTags();
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const tags = React.useMemo(() => app.tags ?? [], [app.tags]);
  const listId = `tag-suggestions-${app.id}`;
  const inputId = `tag-input-${app.id}`;
  const errId = `${inputId}-error`;
  const full = tags.length >= MAX_TAGS;

  const save = (next: string[]) =>
    update.mutate(
      { id: app.id, tags: next },
      {
        onSuccess: () => setDraft(""),
        onError: (e) => toastError(e, t),
      },
    );

  const add = (raw: string) => {
    const r = addTag(tags, raw);
    if (!r.ok) {
      setError(
        r.reason === "empty"
          ? null
          : r.reason === "too_long"
            ? tt("too_long", { max: MAX_TAG_LENGTH })
            : r.reason === "duplicate"
              ? tt("duplicate")
              : tt("limit", { max: MAX_TAGS }),
      );
      return;
    }
    setError(null);
    save(r.tags);
  };

  const q = normalizeTag(draft);
  const suggestions = (all.data ?? [])
    .filter((s) => !tags.includes(s.tag) && (!q || s.tag.includes(q)))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <span className="text-fg text-sm font-medium" id={`${inputId}-label`}>
        {tt("label")}
      </span>
      {tags.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-labelledby={`${inputId}-label`}>
          {tags.map((tag) => (
            <li key={tag}>
              <span className="bg-surface-hover text-fg-body inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2 text-xs font-semibold">
                {tag}
                <button
                  type="button"
                  onClick={() => save(tags.filter((x) => x !== tag))}
                  disabled={update.isPending}
                  className="hover:bg-surface-muted focus-visible:outline-ring inline-flex size-5 items-center justify-center rounded-full focus-visible:outline-2"
                  aria-label={tt("remove", { tag })}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted text-xs">{tt("empty")}</p>
      )}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
        }}
      >
        <Input
          id={inputId}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          list={listId}
          maxLength={MAX_TAG_LENGTH + 10}
          placeholder={full ? tt("limit", { max: MAX_TAGS }) : tt("placeholder")}
          disabled={full || update.isPending}
          aria-labelledby={`${inputId}-label`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className="sm:w-64"
          autoComplete="off"
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s.tag} value={s.tag} />
          ))}
        </datalist>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={full || !q}
          loading={update.isPending}
        >
          {tt("add")}
        </Button>
      </form>
      {error ? (
        <p id={errId} role="alert" className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
      {suggestions.length && !full ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-fg-muted text-xs">{tt("suggestions")}</span>
          {suggestions.slice(0, 5).map((s) => (
            <button
              key={s.tag}
              type="button"
              onClick={() => add(s.tag)}
              disabled={update.isPending}
              className="border-border text-fg-body hover:bg-surface-hover focus-visible:outline-ring rounded-full border px-2 py-0.5 text-xs focus-visible:outline-2"
              aria-label={tt("add_named", { tag: s.tag })}
            >
              + {s.tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
