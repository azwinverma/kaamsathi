import { getTranslations } from "next-intl/server";
import { BolauChrome, WRAP } from "@/components/bolau/chrome";
import { DotTexture } from "@/components/signature/dot-texture";
import { cn } from "@/lib/utils";

type Shape = "profile" | "article" | "form";

/**
 * Loading screen for public pages (loading.tsx; B · street mural). The real site header stays, so
 * only the page body is a placeholder: the blue hero band with shimmering lines, then a paper card
 * shaped like what is coming (a Sipalu profile, a help article or a booking form).
 */
export async function PublicPageSkeleton({ shape }: { shape: Shape }) {
  const t = await getTranslations("common");
  return (
    <BolauChrome footer={false}>
      <div role="status" aria-busy className="animate-fade-in">
        <span className="sr-only">{t("loading")}</span>
        <section aria-hidden className="bg-hero relative isolate overflow-hidden">
          <span className="bg-hero-gradient absolute inset-0 -z-10 opacity-90" />
          <DotTexture className="-z-10" />
          <div className={cn(WRAP, "flex items-end gap-5 pt-10 pb-20 sm:pt-14")}>
            {shape === "profile" ? (
              <div className="skeleton-on-hero size-24 shrink-0 rotate-[-3deg] rounded-[14px] sm:size-28" />
            ) : null}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="skeleton-on-hero h-3.5 w-32" />
              <div className="skeleton-on-hero h-9 w-full max-w-[26rem]" />
              {shape !== "profile" ? <div className="skeleton-on-hero h-9 w-2/3 max-w-[18rem]" /> : null}
              <div className="skeleton-on-hero h-4 w-full max-w-[32rem]" />
            </div>
          </div>
        </section>

        <div aria-hidden className={cn(WRAP, "relative -mt-10 pb-16")}>
          <div className="bg-surface rounded-card p-5 shadow-[6px_8px_0_0_var(--color-yellow)] sm:p-7">
            {shape === "form" ? <FormLines /> : shape === "profile" ? <ProfileLines /> : <ArticleLines />}
          </div>
        </div>
      </div>
    </BolauChrome>
  );
}

function ProfileLines() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[20, 28, 24].map((w) => (
          <div key={w} className="skeleton h-9 rounded-pill" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-border space-y-2 rounded-dense border p-4">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-6 w-24" />
          </div>
        ))}
      </div>
      <ArticleLines />
    </div>
  );
}

function ArticleLines() {
  return (
    <div className="max-w-2xl space-y-3">
      {["w-full", "w-11/12", "w-full", "w-4/5", "w-2/3"].map((w, i) => (
        <div key={i} className={cn("skeleton h-4", w)} />
      ))}
    </div>
  );
}

function FormLines() {
  return (
    <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-3.5 w-24" />
          <div className="skeleton h-11 w-full rounded-control" />
        </div>
      ))}
      <div className="bg-yellow/60 h-12 w-40 animate-pulse rounded-control sm:col-span-2" />
    </div>
  );
}
