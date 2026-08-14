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
async function rawRequest<T>(path: string, init: FetchInit = {}): Promise<Envelope<T>> {
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

/**
 * Paths that must never trigger a refresh-and-retry.
 *
 * A 401 from `/auth/login` means the password was wrong — retrying it after a
 * refresh would turn one clear error into two requests and a confusing one.
 * A 401 from `/auth/refresh` is the refresh itself failing, and retrying that
 * is an infinite loop.
 */
const NO_RETRY = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

/** Returns just `data`. The common case. */
export async function apiFetch<T>(path: string, init?: FetchInit): Promise<T> {
  const { data } = await apiRequest<T>(path, init);
  return data;
}

/**
 * `apiRequest`, but a 401 transparently refreshes the session and retries once.
 *
 * ── WHY THIS EXISTS ──
 *
 * Access tokens last 15 minutes. Without this, a user reading a finding for
 * sixteen minutes would have their next click fail — and the honest-looking
 * fix, a long-lived access token, is the one that cannot be revoked.
 *
 * Exactly ONE retry. A second 401 after a successful refresh is not a timing
 * problem, it is a real authorization failure, and retrying it forever would
 * hide that behind a hung request.
 */
export async function apiRequest<T>(path: string, init: FetchInit = {}): Promise<Envelope<T>> {
  try {
    return await rawRequest<T>(path, init);
  } catch (err) {
    const unauthorized = err instanceof ApiError && err.status === 401;
    if (!unauthorized || NO_RETRY.some((p) => path.startsWith(p))) throw err;

    // Imported lazily: `auth.ts` imports this module, and a static import back
    // would be a cycle that leaves one of them half-initialised at runtime.
    const { refreshOnce } = await import("./auth");
    if (!(await refreshOnce())) throw err;

    return rawRequest<T>(path, init);
  }
}
