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
   ========================================================================== */

export async function serverFetch<T>(path: string, timeoutMs = 10_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
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
