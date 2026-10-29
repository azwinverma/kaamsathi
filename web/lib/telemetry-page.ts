/**
 * Page names for `page_view` events: the route *template*, never the concrete URL. Record ids
 * become `:id`, and public profile handles (which are often people's names, e.g. `/p/ram-bhanse`)
 * become `:handle`, so a page view can't identify anyone.
 */
const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
/** Everything after these segments is person-specific (public passport codes and share tokens,
 * Sipalu handles), except the static pages listed in KEEP. */
const HANDLE_PARENTS = new Set(["p", "sipalu", "book"]);
const KEEP = new Set(["join"]);

export function pageTemplate(pathname: string): string {
  const parts = pathname.split(/[?#]/)[0].split("/").filter(Boolean);
  let masked = false;
  const out = parts.map((seg, i) => {
    if (masked) return ":handle";
    if (UUID.test(seg)) return ":id";
    if (NUMERIC.test(seg)) return ":n";
    if (i > 0 && HANDLE_PARENTS.has(parts[i - 1]) && !KEEP.has(seg)) {
      masked = true;
      return ":handle";
    }
    if (seg.length > 40) return ":id";
    return seg;
  });
  return `/${out.join("/")}`.slice(0, 120);
}
