import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Logo } from "@/components/brand";
import { LanguageToggle, ThemeToggle } from "@/components/providers/preferences";

export type LegalDoc = "privacy" | "terms";

interface LegalSection {
  id: string;
  title: string;
  body: string[];
  items?: string[];
}

/** Shared header/footer frame for public, unauthenticated pages (legal, errors). */
export async function PublicFrame({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="bg-bg flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-brand text-brand-fg sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("common.skip_to_content")}
      </a>
      <header className="border-border bg-surface/85 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Logo name={t("app.name")} />
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageToggle compact />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-border border-t">
        <div className="text-fg-subtle mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {t("legal.footer_note")}</span>
          <nav className="flex gap-4" aria-label={t("legal.contents")}>
            <Link href="/privacy" className="hover:text-fg">
              {t("legal.privacy_link")}
            </Link>
            <Link href="/terms" className="hover:text-fg">
              {t("legal.terms_link")}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export async function DraftBanner() {
  const t = await getTranslations("legal");
  return (
    <div
      role="note"
      className="border-warning/40 bg-warning-subtle text-warning flex items-start gap-3 rounded-lg border px-4 py-3"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">{t("draft_title")}</p>
        <p className="text-sm opacity-90">{t("draft_body")}</p>
      </div>
    </div>
  );
}

function PlaceholderTag({ label }: { label: string }) {
  return (
    <span className="bg-warning-subtle text-warning ml-2 rounded px-1.5 py-0.5 align-middle text-[11px] font-medium">
      {label}
    </span>
  );
}

async function ContactCard() {
  const t = await getTranslations("legal");
  const rows = [
    {
      icon: UserRound,
      label: t("contact.officer_label"),
      value: t("contact.officer"),
      placeholder: false,
    },
    {
      icon: Mail,
      label: t("contact.email_label"),
      value: (
        <a href={`mailto:${t("contact.email")}`} className="text-brand hover:underline">
          {t("contact.email")}
        </a>
      ),
      placeholder: true,
    },
    { icon: Phone, label: t("contact.phone_label"), value: t("contact.phone"), placeholder: true },
    {
      icon: MapPin,
      label: t("contact.address_label"),
      value: t("contact.address"),
      placeholder: true,
    },
  ];
  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="border-border bg-surface scroll-mt-24 rounded-xl border p-5 shadow-sm sm:p-6"
    >
      <h2 id="contact-title" className="text-fg text-xl font-semibold">
        {t("contact.title")}
      </h2>
      <p className="text-fg-body mt-2">{t("contact.body")}</p>
      <dl className="divide-border mt-4 divide-y">
        {rows.map(({ icon: Icon, label, value, placeholder }) => (
          <div
            key={label}
            className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <dt className="text-fg-muted flex shrink-0 items-center gap-2 text-sm sm:w-44">
              <Icon className="size-4" aria-hidden />
              {label}
            </dt>
            <dd className="text-fg text-sm break-words">
              {value}
              {placeholder ? <PlaceholderTag label={t("placeholder")} /> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-fg-muted mt-3 text-xs">{t("contact.placeholder_note")}</p>
    </section>
  );
}

/** Draft legal document (Privacy Policy or Terms), rendered in the visitor's current locale. */
export async function LegalDocument({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("legal");
  const sections = t.raw(`${doc}.sections`) as LegalSection[];
  const other: LegalDoc = doc === "privacy" ? "terms" : "privacy";

  return (
    <PublicFrame>
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <DraftBanner />
        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label={t("contents")} className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-fg-muted text-xs font-semibold tracking-wide uppercase">
              {t("contents")}
            </p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-fg-muted hover:text-fg">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
              <li>
                <a href="#contact" className="text-fg-muted hover:text-fg">
                  {sections.length + 1}. {t("contact.title")}
                </a>
              </li>
            </ol>
          </nav>

          <article className="min-w-0">
            <header className="border-border border-b pb-6">
              <h1 className="text-fg text-3xl font-semibold sm:text-4xl">{t(`${doc}.title`)}</h1>
              <p className="text-fg-muted mt-2 text-sm">{t("version")}</p>
              <p className="text-fg-body mt-4 text-base leading-relaxed">{t(`${doc}.intro`)}</p>
            </header>

            <div className="mt-8 space-y-9">
              {sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  aria-labelledby={`${s.id}-title`}
                  className="scroll-mt-24"
                >
                  <h2 id={`${s.id}-title`} className="text-fg text-xl font-semibold">
                    {i + 1}. {s.title}
                  </h2>
                  <div className="text-fg-body mt-3 space-y-3 leading-relaxed">
                    {s.body.map((p, j) => (
                      <p key={j}>{p}</p>
                    ))}
                    {s.items?.length ? (
                      <ul className="marker:text-fg-subtle list-disc space-y-1.5 pl-5">
                        {s.items.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              ))}
              <ContactCard />
            </div>

            <div className="border-border mt-10 flex flex-wrap gap-4 border-t pt-6 text-sm">
              <Link href={`/${other}`} className="text-brand font-medium hover:underline">
                {t(`${other}_link`)}
              </Link>
              <Link href="/" className="text-fg-muted hover:text-fg">
                {t("back_home")}
              </Link>
            </div>
          </article>
        </div>
      </div>
    </PublicFrame>
  );
}
