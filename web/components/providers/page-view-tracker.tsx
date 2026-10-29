"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/telemetry";
import { pageTemplate } from "@/lib/telemetry-page";

/** One `page_view` per route change (template only, see lib/telemetry-page.ts). */
export function PageViewTracker() {
  const pathname = usePathname();
  const last = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!pathname) return;
    const page = pageTemplate(pathname);
    if (page === last.current) return;
    last.current = page;
    track("page_view", { page });
  }, [pathname]);
  return null;
}
