import { cookies } from "next/headers";
import { API_BASE } from "./config";

/* ============================================================================
   Server-side fetch, for React Server Components.

   Separate from `client.ts` on purpose. That module sets
   `credentials: "include"`, which is meaningless on the server and throws in
   some runtimes, and its ApiError carries browser-shaped messaging ("Is the
   backend running?"). More importantly, a server component that throws takes
   the whole route down — so everything here returns `null` on failure and lets
   the page decide what to render instead.

   `cache: "no-store"` because every one of these reads is live analysis state.
   Next would otherwise cache the fetch for the lifetime of the build and the
   review screen would show one run forever.

   ── ⚠️ THE COOKIE HEADER IS NOT OPTIONAL ──

   A server component's `fetch` runs in Node. It has no cookie jar, so nothing
   is attached automatically and `credentials: "include"` does nothing. The
   session lives in httpOnly cookies on the incoming request, and forwarding
   them by hand is the ONLY way this reaches the API as the signed-in user.

   Leaving it out does not produce an error anyone would notice: every call
   401s, every 401 becomes `null`, and every page renders its empty state. The
   review screen says "Nothing to review yet" about a project that was analysed
   thirty seconds ago, and the dashboard says a repo has never been run. That
   is exactly what happened when auth landed and this function still fetched
   anonymously.
   ========================================================================== */

export async function serverFetch<T>(path: string, timeoutMs = 10_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(await cookieHeader()),
      },
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { data?: T };
    return body.data ?? null;
  } catch {
    // Backend down, timed out, or returned something that is not JSON. The
    // caller falls back to fixtures — a review screen that renders nothing
    // because the API is restarting is worse than one showing sample data.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The incoming request's cookies, as a header.
 *
 * `cookies()` only works inside a request scope. It throws during static
 * generation and at module load, so this returns an empty object there rather
 * than taking the build down — an unauthenticated fetch is the correct
 * behaviour when there is no request to be authenticated as.
 */
async function cookieHeader(): Promise<Record<string, string>> {
  try {
    const jar = await cookies();
    const all = jar.getAll();
    if (all.length === 0) return {};
    return { cookie: all.map((c) => `${c.name}=${c.value}`).join("; ") };
  } catch {
    return {};
  }
}
