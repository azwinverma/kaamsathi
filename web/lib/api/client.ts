/**
 * Browser API client. Every call goes through the BFF proxy (`/api/proxy/*`), which attaches
 * the JWT (httpOnly cookie), X-Org-Id and Accept-Language server-side. Tokens never reach JS.
 */
import { ApiError, parseApiError } from "./errors";

export const PROXY_BASE = "/api/proxy";

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function proxyUrl(path: string, params?: QueryParams): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${PROXY_BASE}${clean}${buildQuery(params)}`;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Called when the session is gone (refresh failed). Set by the app shell. */
let onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(fn: (() => void) | null) {
  onUnauthenticated = fn;
}

export interface RequestOptions {
  params?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) {
    body = opts.body;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(proxyUrl(path, opts.params), {
      method,
      headers,
      body,
      signal: opts.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e;
    throw new ApiError(0, "network_error", "Network error. Check your connection.");
  }
  if (res.status === 204) return undefined as T;
  const data = await readBody(res);
  if (!res.ok) {
    const err = parseApiError(res.status, data);
    if (res.status === 401 && onUnauthenticated) onUnauthenticated();
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, params?: QueryParams, signal?: AbortSignal) =>
    request<T>("GET", path, { params, signal }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, form: FormData) => request<T>("POST", path, { body: form }),
};

/** URL usable directly in <img src> / <a href> for binary endpoints (QR png, PDFs). */
export function proxyHref(path: string, params?: QueryParams): string {
  return proxyUrl(path, params);
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

/** Download a binary export (xlsx/csv/pdf/png) through the proxy and save it. */
export async function downloadFile(path: string, fallbackName: string, params?: QueryParams) {
  let res: Response;
  try {
    res = await fetch(proxyUrl(path, params), { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "network_error", "Network error. Check your connection.");
  }
  if (!res.ok) throw parseApiError(res.status, await readBody(res));
  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get("Content-Disposition")) ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fetch all pages of a paginated endpoint (bounded). */
export async function fetchAllPages<T>(
  path: string,
  params: QueryParams = {},
  maxPages = 10,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await api.get<{ results: T[]; next: string | null } | T[]>(path, {
      ...params,
      page,
      page_size: 100,
    });
    if (Array.isArray(data)) return data;
    out.push(...data.results);
    if (!data.next) break;
  }
  return out;
}

/** Normalise list endpoints that may be paginated or plain arrays. */
export function listResults<T>(data: { results: T[] } | T[] | undefined | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : (data.results ?? []);
}
