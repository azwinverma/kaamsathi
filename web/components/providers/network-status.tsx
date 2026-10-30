"use client";
import * as React from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Wifi, WifiOff } from "lucide-react";
import { navProgressActive, subscribeNavProgress } from "@/lib/nav-progress";
import { cn } from "@/lib/utils";

const SLOW_AFTER_MS = 4000;
const BACK_ONLINE_MS = 2500;

type Mode = "offline" | "online" | "slow" | null;

/**
 * Small pill at the bottom of the screen when the network gets in the way:
 * - offline (the browser says so) → stays until the connection is back, then "Back online" briefly;
 * - slow → any data request, save or page change has taken longer than 4 s.
 * Queries refetch on their own when the connection returns (TanStack Query's onlineManager).
 */
export function NetworkStatus() {
  const t = useTranslations("common");
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const [navigating, setNavigating] = React.useState(false);
  const [online, setOnline] = React.useState(true);
  const [backOnline, setBackOnline] = React.useState(false);
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    setNavigating(navProgressActive());
    return subscribeNavProgress(setNavigating);
  }, []);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const up = () => {
      setOnline(true);
      setBackOnline(true);
      clearTimeout(timer);
      timer = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
    };
    const down = () => {
      clearTimeout(timer);
      setBackOnline(false);
      setOnline(false);
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const busy = fetching + mutating > 0 || navigating;
  React.useEffect(() => {
    if (!busy) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [busy]);

  const mode: Mode = !online ? "offline" : backOnline ? "online" : slow ? "slow" : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4"
    >
      {mode ? (
        <p
          key={mode}
          className={cn(
            "animate-pop-in pointer-events-auto inline-flex max-w-full items-center gap-2.5 rounded-pill border px-4 py-2 text-sm font-semibold shadow-floating",
            mode === "offline" && "border-fg bg-fg text-bg",
            mode === "online" && "border-success bg-success-subtle text-fg",
            mode === "slow" && "border-border-strong bg-surface text-fg",
          )}
        >
          {mode === "offline" ? <WifiOff className="size-4 shrink-0" aria-hidden /> : null}
          {mode === "online" ? <Wifi className="text-success size-4 shrink-0" aria-hidden /> : null}
          {mode === "slow" ? <WorkingDots /> : null}
          <span className="min-w-0">
            {mode === "offline" ? t("offline") : mode === "online" ? t("back_online") : t("slow_network")}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Three dots in brand blue, yellow and teal taking turns: "still working". */
function WorkingDots() {
  return (
    <span aria-hidden className="inline-flex items-center gap-1">
      {["bg-brand", "bg-yellow", "bg-teal"].map((c, i) => (
        <span key={c} className={cn("ks-working-dot size-1.5 rounded-full", c)} style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
