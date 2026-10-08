"use client";
import * as React from "react";
import { Lock, Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { useCaseMessages, usePostCaseMessage } from "@/lib/api/hooks/support";
import type { CaseMessage, SupportCase, SupportScope } from "@/lib/api/types-support";
import { toastError } from "@/lib/forms";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

type ReplyMode = "reply" | "internal" | "call";

/**
 * Message thread for a support case. Requesters (`org`/`me`) never receive internal notes from
 * the API; staff (`ops`) see them highlighted and can add notes or phone-call notes.
 */
export function CaseThread({ scope, c }: { scope: SupportScope; c: SupportCase }) {
  const t = useTranslations("support.thread");
  const query = useCaseMessages(scope, c.id);
  const staff = scope === "ops";
  const endRef = React.useRef<HTMLLIElement>(null);
  const count = query.data?.length ?? 0;
  React.useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [count]);

  return (
    <section aria-labelledby={`thread-${c.id}`} className="space-y-4">
      <h2 id={`thread-${c.id}`} className="text-sm font-semibold text-fg">
        {t("title")}
      </h2>
      <ol className="space-y-3">
        <li>
          <Bubble
            mine={!staff}
            author={staff ? c.requester.full_name : t("you")}
            when={c.created_at}
            body={c.description}
            tone="requester"
          />
        </li>
        {query.isLoading ? (
          <li>
            <Skeleton className="h-16 rounded-dense" />
          </li>
        ) : query.isError ? (
          <li>
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          </li>
        ) : (
          query.data?.map((m) => (
            <li key={m.id}>
              <MessageBubble m={m} staff={staff} />
            </li>
          ))
        )}
        <li ref={endRef} aria-hidden />
      </ol>
      {c.status === "closed" ? (
        <p className="rounded-md bg-surface-muted px-3 py-2 text-sm text-fg-muted">{t("closed_note")}</p>
      ) : (
        <Composer scope={scope} c={c} />
      )}
    </section>
  );
}

function MessageBubble({ m, staff }: { m: CaseMessage; staff: boolean }) {
  const t = useTranslations("support.thread");
  const mine = staff ? m.from_staff : !m.from_staff;
  const name = m.author?.full_name ?? (m.from_staff ? t("support_team") : t("requester"));
  return (
    <Bubble
      mine={mine}
      author={!staff && !m.from_staff ? t("you") : name}
      when={m.created_at}
      body={m.body}
      tone={m.internal ? "internal" : m.from_staff ? "staff" : "requester"}
      tag={
        m.internal ? (
          <span className="inline-flex items-center gap-1 text-warning">
            {m.channel === "phone" ? <Phone className="size-3" aria-hidden /> : <Lock className="size-3" aria-hidden />}
            {m.channel === "phone" ? t("call_note") : t("internal_note")}
          </span>
        ) : null
      }
    />
  );
}

function Bubble({
  mine,
  author,
  when,
  body,
  tone,
  tag,
}: {
  mine: boolean;
  author: string;
  when: string;
  body: string;
  tone: "requester" | "staff" | "internal";
  tag?: React.ReactNode;
}) {
  const f = useFormat();
  return (
    <article className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(36rem,92%)] rounded-dense border px-3 py-2",
          tone === "internal" && "border-dashed border-warning/50 bg-warning-subtle",
          tone === "staff" && "border-brand/20 bg-brand-subtle/60",
          tone === "requester" && "border-border bg-surface",
        )}
      >
        <header className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
          <span className="font-medium text-fg-body">{author}</span>
          <time dateTime={when}>{f.dateTime(when)}</time>
          {tag}
        </header>
        <p className="mt-1 text-sm whitespace-pre-line text-fg">{body}</p>
      </div>
    </article>
  );
}

function Composer({ scope, c }: { scope: SupportScope; c: SupportCase }) {
  const t = useTranslations("support.thread");
  const tAll = useTranslations();
  const post = usePostCaseMessage(scope);
  const [body, setBody] = React.useState("");
  const [mode, setMode] = React.useState<ReplyMode>("reply");
  const staff = scope === "ops";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    post.mutate(
      {
        id: c.id,
        body: body.trim(),
        ...(staff ? { internal: mode !== "reply", channel: mode === "call" ? "phone" : "web" } : {}),
      },
      {
        onSuccess: () => {
          setBody("");
          toast.success(mode === "reply" ? t("sent_toast") : t("note_saved_toast"));
        },
        onError: (err) => toastError(err, tAll),
      },
    );
  };
  return (
    <form onSubmit={submit} className="space-y-2 rounded-dense border border-border bg-surface p-3" noValidate>
      {staff ? (
        <Segmented
          size="sm"
          label={t("reply_mode")}
          value={mode}
          onChange={setMode}
          options={[
            { value: "reply", label: t("mode_reply") },
            { value: "internal", label: t("mode_internal") },
            { value: "call", label: t("mode_call") },
          ]}
        />
      ) : null}
      <Field
        id={`reply-${c.id}`}
        label={<span className="sr-only">{t("message_label")}</span>}
        hint={staff ? (mode === "reply" ? t("hint_reply") : t("hint_internal")) : t("hint_requester")}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder={mode === "call" ? t("placeholder_call") : t("placeholder")}
          className={cn(staff && mode !== "reply" && "border-warning/50 bg-warning-subtle/40")}
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={post.isPending} disabled={!body.trim()}>
          <Send aria-hidden />
          {mode === "reply" ? t("send") : t("save_note")}
        </Button>
      </div>
    </form>
  );
}
