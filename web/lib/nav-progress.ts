/**
 * Page-change progress (the thin bar under the header, components/providers/nav-progress.tsx).
 *
 * The App Router has no "navigation started" event, so a navigation starts when a same-site link
 * is clicked (see `isNavigatingClick`) or code calls `startNavProgress()` before `router.push`;
 * it ends when the pathname or query string changes. A safety timeout ends it if the navigation
 * never lands (cancelled, or an error page with the same URL).
 */

type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let active = false;
let since = 0;

function emit(next: boolean) {
  if (active === next) return;
  active = next;
  since = next ? Date.now() : 0;
  for (const l of listeners) l(next);
}

export function startNavProgress() {
  emit(true);
}

export function doneNavProgress() {
  emit(false);
}

export function navProgressActive(): boolean {
  return active;
}

/** Milliseconds since the current navigation started (0 when idle). */
export function navProgressElapsed(): number {
  return active ? Date.now() - since : 0;
}

export function subscribeNavProgress(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Does this click navigate to another page of this site inside the app (not a new tab, download or #hash jump)? */
export function isNavigatingClick(
  e: Pick<MouseEvent, "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "defaultPrevented">,
  anchor: Pick<HTMLAnchorElement, "href" | "target" | "hasAttribute">,
  current: Pick<Location, "origin" | "pathname" | "search">,
): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return false;
  let url: URL;
  try {
    url = new URL(anchor.href, current.origin);
  } catch {
    return false;
  }
  if (url.origin !== current.origin) return false;
  // Route handlers (file downloads, auth) are not page navigations.
  if (url.pathname.startsWith("/api/")) return false;
  return url.pathname !== current.pathname || url.search !== current.search;
}
