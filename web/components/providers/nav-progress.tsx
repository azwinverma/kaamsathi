"use client";
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  doneNavProgress,
  isNavigatingClick,
  startNavProgress,
  subscribeNavProgress,
} from "@/lib/nav-progress";

const SHOW_AFTER_MS = 120; // prefetched pages land before this: no flash
const GIVE_UP_MS = 15_000;

/**
 * Thin brand-blue → yellow bar along the top edge while the next page loads (lib/nav-progress.ts).
 * Decorative: pages announce their own loading state (loading.tsx, skeletons with role="status").
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? "";
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (anchor instanceof HTMLAnchorElement && isNavigatingClick(e, anchor, window.location)) startNavProgress();
    };
    // Capture phase: next/link calls preventDefault (it navigates client-side) before a bubbling
    // listener on document would run.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", startNavProgress);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", startNavProgress);
    };
  }, []);

  // A changed URL means the new page has rendered.
  React.useEffect(() => {
    doneNavProgress();
  }, [pathname, search]);

  React.useEffect(() => {
    let show: ReturnType<typeof setTimeout> | undefined;
    let trickle: ReturnType<typeof setInterval> | undefined;
    let giveUp: ReturnType<typeof setTimeout> | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(show);
      clearInterval(trickle);
      clearTimeout(giveUp);
      clearTimeout(hide);
    };
    const off = subscribeNavProgress((active) => {
      clear();
      if (active) {
        setProgress(0.08);
        show = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
        // Fast at first, then slower and slower towards 90 %: it never claims to be done.
        trickle = setInterval(() => setProgress((p) => p + (0.9 - p) * 0.1), 250);
        giveUp = setTimeout(doneNavProgress, GIVE_UP_MS);
      } else {
        setProgress(1);
        hide = setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 280);
      }
    });
    return () => {
      off();
      clear();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full origin-left rounded-r-full transition-[width] duration-200 ease-out"
        style={{
          width: `${Math.round(progress * 100)}%`,
          background: "linear-gradient(90deg, var(--color-brand), var(--color-yellow))",
          boxShadow: "0 0 10px var(--color-yellow), 0 0 4px var(--color-brand)",
        }}
      />
    </div>
  );
}
