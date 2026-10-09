"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/lib/api/hooks/auth";
import { useFavourites, useToggleFavourite } from "@/lib/api/hooks/bolau";
import { errorMessage } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

/** Save / unsave a Sipalu. Signed-out visitors are sent to log in and come straight back. */
export function FavouriteButton({ handle, name, className }: { handle: string; name: string; className?: string }) {
  const t = useTranslations("bolau");
  const te = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const me = useMe();
  const signedIn = !!me.data;
  const favs = useFavourites(signedIn);
  const toggle = useToggleFavourite();
  const saved = !!favs.data?.some((f) => f.handle === handle);

  return (
    <button
      type="button"
      aria-pressed={signedIn ? saved : undefined}
      disabled={toggle.isPending}
      onClick={() => {
        if (!signedIn) {
          router.push(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        toggle.mutate(
          { handle, on: !saved },
          { onError: (e) => toast.error(errorMessage(e, te)) },
        );
      }}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-control border-2 border-white px-4 font-semibold text-hero-fg transition-colors hover:bg-white/10 disabled:opacity-60",
        className,
      )}
    >
      <Heart className={cn("size-4", saved && "fill-coral stroke-coral")} aria-hidden />
      <span>{saved ? t("profile.saved") : t("profile.save")}</span>
      <span className="sr-only">{name}</span>
    </button>
  );
}
