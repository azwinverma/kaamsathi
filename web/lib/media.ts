/**
 * Sensitive files (worker photo, ID front/back, documents) come from the API as short-lived
 * signed URLs: `<api origin>/api/v1/files/<token>`. Rewrite them to the same-origin BFF proxy
 * (`/api/proxy/files/<token>`) so `img-src 'self'` holds and the browser never talks to the
 * API origin directly. Any other URL is returned unchanged.
 */
const FILE_PATH_RE = /\/api\/v1\/files\/([A-Za-z0-9_\-:.]+)\/?(?=$|[?#])/;

export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  let path = url;
  let search = "";
  try {
    // Absolute or protocol-relative → take path + query; relative paths parse against a dummy base.
    const u = new URL(url, "http://local.invalid");
    path = u.pathname;
    search = u.search;
  } catch {
    return url;
  }
  const m = FILE_PATH_RE.exec(path);
  if (!m) return url;
  return `/api/proxy/files/${m[1]}${search}`;
}
