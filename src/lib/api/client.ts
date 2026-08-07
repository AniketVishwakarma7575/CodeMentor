import { API_BASE, REQUEST_TIMEOUT_MS } from "./config";

/* ============================================================================
   The single fetch wrapper. Every network call in the app goes through here.

   It exists so that four things are handled in ONE place instead of twelve:
     • the { data } / { error } envelope the API always returns
     • timeouts (fetch has none by default — a hung request hangs forever)
     • credentials + JSON headers
     • a typed error carrying the backend's `code` and `requestId`
   ========================================================================== */

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { field: string; issue: string }[];
  requestId?: string;
}

export interface ApiMeta {
  total?: number;
  hasMore?: boolean;
  nextCursor?: string | null;
}

export interface Envelope<T> {
  data: T;
  meta?: ApiMeta;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorBody["details"];
  readonly requestId?: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.requestId = body.requestId;
  }

  /** True for network blips, rate limits, and 5xx — the caller may retry. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

type FetchInit = RequestInit & { timeoutMs?: number };

/** Returns the FULL envelope. Use when you need `meta` (pagination, totals). */
export async function apiRequest<T>(path: string, init: FetchInit = {}): Promise<Envelope<T>> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...rest } = init;

  // fetch has no built-in timeout. Without this, a wedged connection leaves the
  // UI showing a skeleton that never resolves.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      signal: rest.signal ?? controller.signal,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...rest.headers },
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(0, {
      code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
      message: aborted
        ? `Request timed out after ${timeoutMs}ms`
        : "Could not reach the API. Is the backend running?",
    });
  } finally {
    clearTimeout(timer);
  }

  // 204 has no body — parsing it throws.
  if (res.status === 204) return { data: undefined as T };

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(res.status, {
      code: "MALFORMED_RESPONSE",
      message: `Expected JSON, got ${res.headers.get("content-type") ?? "nothing"}`,
    });
  }

  if (!res.ok) {
    const body = (parsed as { error?: ApiErrorBody }).error;
    throw new ApiError(res.status, body ?? { code: "UNKNOWN", message: res.statusText });
  }

  return parsed as Envelope<T>;
}

/** Returns just `data`. The common case. */
export async function apiFetch<T>(path: string, init?: FetchInit): Promise<T> {
  const { data } = await apiRequest<T>(path, init);
  return data;
}
