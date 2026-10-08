import "server-only";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, LifeBuoy, Search, ShieldAlert } from "lucide-react";
import { backendJson } from "@/lib/server/session";
import type { HelpArticle, HelpAudience } from "@/lib/api/types-support";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

const SLUG_RE = /^[a-z0-9-]{1,80}$/;

/** Published articles (public endpoint, no auth). Empty list on any backend error. */
export async function fetchHelpArticles(
  lang: string,
  params: { audience?: string; q?: string },
): Promise<HelpArticle[]> {
  const sp = new URLSearchParams();
  if (params.audience === "worker" || params.audience === "employer") sp.set("audience", params.audience);
  if (params.q) sp.set("q", params.q.slice(0, 100));
  const res = await backendJson(`/help/articles${sp.size ? `?${sp}` : ""}`, { lang });
  return res.status === 200 && Array.isArray(res.data) ? (res.data as HelpArticle[]) : [];
}

export async function fetchHelpArticle(lang: string, slug: string): Promise<HelpArticle | null> {
  if (!SLUG_RE.test(slug)) return null;
  const res = await backendJson(`/help/articles/${slug}`, { lang });
  return res.status === 200 && res.data && typeof res.data === "object" ? (res.data as HelpArticle) : null;
}

const AUDIENCES: (HelpAudience | "all")[] = ["all", "worker", "employer"];

export async function HelpIndex({
  articles,
  audience,
  q,
}: {
  articles: HelpArticle[];
  audience: string;
  q: string;
}) {
  const t = await getTranslations("support.help");
  const groups = new Map<string, HelpArticle[]>();
  for (const a of articles) {
    const list = groups.get(a.category_label) ?? [];
    list.push(a);
    groups.set(a.category_label, list);
  }
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-fg">{t("title")}</h1>
        <p className="text-fg-muted">{t("subtitle")}</p>
        <form action="/help" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
          {audience !== "all" ? <input type="hidden" name="audience" value={audience} /> : null}
          <label htmlFor="help-q" className="sr-only">
            {t("search_label")}
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" aria-hidden />
            <input
              id="help-q"
              name="q"
              defaultValue={q}
              placeholder={t("search_placeholder")}
              className="h-10 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm text-fg shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-md bg-brand px-4 text-sm font-medium text-brand-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {t("search")}
          </button>
        </form>
        <nav aria-label={t("audience_label")} className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => {
            const href = `/help?${new URLSearchParams({ ...(a !== "all" ? { audience: a } : {}), ...(q ? { q } : {}) })}`;
            const active = audience === a;
            return (
              <Link
                key={a}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm",
                  active ? "border-brand bg-brand-subtle font-medium text-brand" : "border-border text-fg-body hover:bg-surface-hover",
                )}
              >
                {t(`audience_${a}`)}
              </Link>
            );
          })}
        </nav>
      </header>

      {articles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-fg-muted">
          {q ? t("no_results", { q }) : t("empty")}
        </p>
      ) : (
        [...groups.entries()].map(([category, list]) => (
          <section key={category} aria-labelledby={`cat-${category}`} className="space-y-3">
            <h2 id={`cat-${category}`} className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
              {category}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="block h-full rounded-lg border border-border bg-surface p-4 shadow-sm transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="font-medium text-fg">{a.title}</span>
                    <span className="mt-1 block text-xs text-fg-muted">{a.audience_label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <ContactBox />
    </div>
  );
}

export async function HelpArticleView({ article }: { article: HelpArticle }) {
  const t = await getTranslations("support.help");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <Link href="/help" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <article className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-medium text-fg-muted">
            {article.category_label} · {article.audience_label}
          </p>
          <h1 className="text-2xl font-semibold text-fg">{article.title}</h1>
        </header>
        <Markdown source={article.body} className="text-base" />
      </article>
      <ContactBox />
    </div>
  );
}

async function ContactBox() {
  const t = await getTranslations("support.help");
  return (
    <aside className="grid gap-3 rounded-lg border border-border bg-surface-muted p-5 sm:grid-cols-2">
      <div className="flex gap-3">
        <LifeBuoy className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
        <div>
          <p className="font-medium text-fg">{t("contact_title")}</p>
          <p className="text-sm text-fg-muted">{t("contact_body")}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
        <div>
          <p className="font-medium text-fg">{t("safety_title")}</p>
          <p className="text-sm text-fg-muted">{t("safety_body")}</p>
        </div>
      </div>
    </aside>
  );
}
