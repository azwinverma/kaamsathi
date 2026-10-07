import type { ApiErrorBody } from "./types";

/** Error thrown by the API client. Mirrors the contract error envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** First message for a field (supports dotted nested keys like "employment.basic_salary"). */
  fieldError(field: string): string | undefined {
    return this.fields[field]?.[0];
  }

  get isValidation(): boolean {
    return this.code === "validation_error" || Object.keys(this.fields).length > 0;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

function isEnvelope(body: unknown): body is ApiErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "object" &&
    (body as { error: unknown }).error !== null
  );
}

/** Flatten nested DRF-style field errors ({employment: {basic_salary: ["…"]}}) to dotted keys. */
export function flattenFieldErrors(input: unknown, prefix = ""): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      const strings = value.filter((v): v is string => typeof v === "string");
      if (strings.length) out[path] = strings;
      value.forEach((v, i) => {
        if (v && typeof v === "object") Object.assign(out, flattenFieldErrors(v, `${path}.${i}`));
      });
    } else if (typeof value === "string") {
      out[path] = [value];
    } else if (value && typeof value === "object") {
      Object.assign(out, flattenFieldErrors(value, path));
    }
  }
  return out;
}

/**
 * Parse any error response body into an ApiError.
 * Handles the contract envelope, DRF's {detail}, and raw field maps.
 */
export function parseApiError(status: number, body: unknown): ApiError {
  if (isEnvelope(body)) {
    const { code, message, fields } = body.error;
    return new ApiError(
      status,
      code || "server_error",
      message || defaultMessage(status),
      flattenFieldErrors(fields ?? {}),
    );
  }
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") {
      return new ApiError(status, typeof b.code === "string" ? b.code : codeForStatus(status), b.detail);
    }
    const fields = flattenFieldErrors(b);
    if (Object.keys(fields).length) {
      return new ApiError(status, "validation_error", defaultMessage(status), fields);
    }
  }
  if (typeof body === "string" && body.trim() && body.length < 300 && !body.trim().startsWith("<")) {
    return new ApiError(status, codeForStatus(status), body.trim());
  }
  return new ApiError(status, codeForStatus(status), defaultMessage(status));
}

function codeForStatus(status: number): string {
  if (status === 0) return "network_error";
  if (status === 400) return "validation_error";
  if (status === 401) return "not_authenticated";
  if (status === 403) return "permission_denied";
  if (status === 404) return "not_found";
  return "server_error";
}

function defaultMessage(status: number): string {
  if (status === 0) return "Network error. Check your connection.";
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Request failed.";
}

/**
 * Push API field errors into react-hook-form. Returns true when at least one field was set.
 * `map` renames API field keys to form field names (e.g. {"site_id": "site"}).
 */
export function applyFieldErrors(
  error: unknown,
  setError: (name: never, err: { type: string; message: string }) => void,
  knownFields: readonly string[],
  map: Record<string, string> = {},
): boolean {
  if (!isApiError(error)) return false;
  let applied = false;
  for (const [key, messages] of Object.entries(error.fields)) {
    const name = map[key] ?? key;
    if (knownFields.includes(name) && messages[0]) {
      setError(name as never, { type: "server", message: messages[0] });
      applied = true;
    }
  }
  return applied;
}
