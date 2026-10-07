"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Languages, Moon, Sun } from "lucide-react";
import { LOCALE_COOKIE, THEME_STORAGE_KEY } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/** Switch UI language (cookie-based; server components re-render via router.refresh). */
export function useSetLocale() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const set = React.useCallback(
    (locale: "en" | "ne") => {
      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = locale;
      start(() => router.refresh());
    },
    [router],
  );
  return { set, pending };
}

export function LanguageToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const { set, pending } = useSetLocale();
  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-border bg-surface p-0.5 text-xs font-medium",
        pending && "opacity-70",
        className,
      )}
    >
      {!compact ? <Languages className="mx-1.5 size-3.5 text-fg-muted" aria-hidden /> : null}
      {(["en", "ne"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={locale === l}
          lang={l}
          className={cn(
            "h-full rounded-[5px] px-2.5 transition-colors",
            locale === l ? "bg-brand-subtle text-brand-subtle-fg" : "text-fg-muted hover:text-fg",
            l === "ne" && "font-nepali",
          )}
        >
          {l === "en" ? "EN" : "नेपाली"}
        </button>
      ))}
    </div>
  );
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Two-state theme toggle (system ↔ opposite), per modern-web-guidance dark-mode:
 * pins the exact opposite scheme; choosing the system scheme again clears the pin.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const [dark, setDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    const read = () => {
      const pinned = document.documentElement.dataset.theme;
      setDark(pinned ? pinned === "dark" : systemPrefersDark());
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  const toggle = () => {
    const nextDark = !dark;
    const meta = document.querySelector('meta[name="color-scheme"]');
    try {
      if (nextDark === systemPrefersDark()) {
        delete document.documentElement.dataset.theme;
        localStorage.removeItem(THEME_STORAGE_KEY);
        meta?.setAttribute("content", "light dark");
      } else {
        const v = nextDark ? "dark" : "light";
        document.documentElement.dataset.theme = v;
        localStorage.setItem(THEME_STORAGE_KEY, v);
        meta?.setAttribute("content", v);
      }
    } catch {
      /* storage unavailable */
    }
    setDark(nextDark);
  };

  const label = dark ? t("switch_to_light") : t("switch_to_dark");
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={toggle}
        aria-label={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg",
          className,
        )}
      >
        {dark ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
      </button>
    </Tooltip>
  );
}
